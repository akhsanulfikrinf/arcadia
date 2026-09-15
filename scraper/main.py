import os
import re
import time
import queue
import random
import threading
import psycopg2
from psycopg2 import pool
from playwright.sync_api import sync_playwright
from utils.storage import SupabaseStorage

# Configuration from environment variables
DATABASE_URL = os.environ.get("DATABASE_URL")
NOVEL_URL = os.environ.get("NOVEL_URL") # Provided via GitHub Actions dispatch
WORKERS = 3
BATCH_SIZE = 5

# Configure Database Pool
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is required")

db_pool = psycopg2.pool.SimpleConnectionPool(
    1, 10,
    dsn=DATABASE_URL
)

# Configure Supabase Storage (for storage-first save system)
storage = SupabaseStorage()

insert_queue = queue.Queue()

# Tracking counters (thread-safe)
stats_lock = threading.Lock()
stats = {'scraped': 0, 'storage_saved': 0, 'db_saved': 0, 'failed': 0, 'skipped': 0}


SPAM_PHRASES = [
    "Tolong donasinya atau bisa klik-klik",
    "dukung kami di",
    "klik iklan",
    "trakteer",
    "donasi",
    "sociabuzz",
    "discord.gg",
    "baca juga",
    "follow instagram",
    "facebook page",
    "join discord",
    "situs resmi",
    "update tercepat",
    "baca di meionovels"
]


def normalize(t):
    return re.sub(r'\s+', ' ', t).strip()


def is_spam(text):
    t = text.lower()
    for s in SPAM_PHRASES:
        if s.lower() in t:
            return True
    return False


def smart_split(blocks):
    result = []
    
    # Filter spam and normalize
    filtered = []
    for b in blocks:
        if b.get("type") == "text":
            t = normalize(b.get("content", ""))
            if not t or is_spam(t):
                continue
            filtered.append({"type": "text", "content": t})
        elif b.get("type") == "title":
            t = normalize(b.get("content", ""))
            if not t or is_spam(t):
                continue
            filtered.append({"type": "title", "content": t})
        elif b.get("type") == "image":
            filtered.append(b)

    text_found = False
    for b in filtered:
        if b["type"] == "text":
            t = b["content"]
            
            # Sub-chapter logic: First text block is often a subtitle
            is_first_text = not text_found
            text_found = True
            
            if len(t) < 100 and (t.upper() == t or t.lower().startswith("bab ") or t.lower().startswith("chapter ") or is_first_text):
                result.append({"type": "title", "content": t})
            elif t.startswith("“") or t.startswith('"'):
                result.append({"type": "dialog", "content": t})
            else:
                result.append({"type": "paragraph", "content": t})

        elif b["type"] == "title":
            result.append({"type": "title", "content": b["content"]})
            
        elif b["type"] == "image":
            result.append(b)

    return result


def scrape_chapter(page, url):
    # Safe navigation with retries
    max_retries = 3
    blocks = []
    
    for attempt in range(max_retries):
        try:
            # Random wait before each chapter to mimic human reading speed
            time.sleep(random.uniform(2.0, 5.0))
            
            # Use domcontentloaded for first attempt, then try alternatives
            wait_strat = "domcontentloaded" if attempt == 0 else "networkidle"
            page.goto(url, timeout=90000, wait_until=wait_strat)
            
            # Ensure we aren't stuck on a Cloudflare challenge
            try:
                page.wait_for_selector('.reading-content', timeout=20000)
            except:
                print(f"Warning: .reading-content not found on attempt {attempt+1}. Title: {page.title()}")
                # If we see Cloudflare titles, we might need a longer wait or manual bypass isn't possible here
                if "Just a moment" in page.title():
                    time.sleep(10) # Wait for potential auto-redirect
                continue

            blocks = page.evaluate("""
            () => {
                const container = document.querySelector('.reading-content');
                if (!container) return [];
                
                let result = [];
                function walk(node) {
            // Check if node is an image
            if (node.nodeName === 'IMG') {
                let src = node.dataset.src || node.dataset.lazySrc || node.src;
                if (src && !src.includes('base64')) {
                    result.push({type:'image', src: src});
                }
                return;
            }

            // Check if node is a heading
            if (/^H[1-6]$/.test(node.nodeName)) {
                let t = node.textContent.trim();
                if (t) result.push({type:'title', content: t});
                return;
            }

            // Check if node is a paragraph (might contain child text or images)
            if (node.nodeName === 'P') {
                // If it's a simple text paragraph, just add it
                if (node.children.length === 0) {
                    let t = node.textContent.trim();
                    if (t) result.push({type:'text', content: t});
                } else {
                    // If it has children (like images or spans), walk through them to preserve order
                    node.childNodes.forEach(walk);
                }
                return;
            }

            // Handle pure text nodes
            if (node.nodeType === Node.TEXT_NODE) {
                let t = node.textContent.trim();
                if (t && t.length > 1) {
                    result.push({type:'text', content: t});
                }
                return;
            }

            // For other containers (divs, sections), recurse into children
            if (node.childNodes && node.childNodes.length > 0) {
                const ignoredTags = ['SCRIPT', 'STYLE', 'IFRAME', 'NOSCRIPT', 'A'];
                if (!ignoredTags.includes(node.nodeName)) {
                    node.childNodes.forEach(walk);
                }
            }
        }

        walk(container);
        return result;
    }
    """)
            
            if blocks and len(blocks) > 0:
                return smart_split(blocks)
                
        except Exception as e:
            print(f"Attempt {attempt+1} failed for {url}: {e}")
            if attempt == max_retries - 1:
                return []
            
    return []


def db_writer():
    conn = db_pool.getconn()
    cur = conn.cursor()

    buffer = []

    while True:
        item = insert_queue.get()

        if item is None:
            break

        buffer.append(item)

        if len(buffer) >= BATCH_SIZE:
            flush_batch(cur, buffer)
            conn.commit()
            buffer.clear()

    if buffer:
        flush_batch(cur, buffer)
        conn.commit()

    cur.close()
    db_pool.putconn(conn)


def flush_batch(cur, batch):
    all_rows = []
    for chapter_id, blocks in batch:
        for pos, b in enumerate(blocks):
            all_rows.append((
                chapter_id,
                b.get("type"),
                b.get("content"),
                b.get("src"),
                pos
            ))
    if all_rows:
        cur.executemany(
            "INSERT INTO public.contents(chapter_id, type, content, image_url, position) VALUES(%s, %s, %s, %s, %s) ON CONFLICT DO NOTHING",
            all_rows
        )


def worker(q, novel_id):
    conn = db_pool.getconn()
    cur = conn.cursor()

    # Check storage availability once per worker
    storage_full = storage.enabled and storage.is_storage_full()
    if storage_full:
        print("WARNING: Storage is near capacity. New content will be saved to database instead.")

    with sync_playwright() as p:
        # Use a realistic User-Agent to avoid being flagged as a bot
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
            viewport={'width': 1280, 'height': 800}
        )
        page = context.new_page()

        while True:
            try:
                idx, ch = q.get(timeout=3)
            except queue.Empty:
                break

            print(f"SCRAPE: [{idx}] {ch['title']}")

            try:
                blocks = scrape_chapter(page, ch["url"])
                
                if blocks and len(blocks) > 0:
                    # Upsert chapter metadata (always goes to DB — it's small)
                    cur.execute(
                        "INSERT INTO public.chapters(novel_id, title, chapter_index, is_scraped) VALUES(%s, %s, %s, true) ON CONFLICT (novel_id, chapter_index) DO UPDATE SET title = EXCLUDED.title, is_scraped = true RETURNING id",
                        (novel_id, ch["title"], idx)
                    )
                    res = cur.fetchone()
                    if res:
                        cid = str(res[0])
                        conn.commit()
                    else:
                        cur.execute("SELECT id FROM public.chapters WHERE novel_id = %s AND chapter_index = %s", (novel_id, idx))
                        cid = str(cur.fetchone()[0])
                        conn.commit()

                    # Storage-first save: try storage, fallback to DB
                    saved_to_storage = False
                    if storage.enabled and not storage_full:
                        saved_to_storage = storage.upload_chapter(str(novel_id), cid, blocks)
                    
                    if saved_to_storage:
                        # Content is in storage — clean up any old DB content for this chapter
                        cur.execute("DELETE FROM public.contents WHERE chapter_id = %s", (cid,))
                        conn.commit()
                        with stats_lock:
                            stats['storage_saved'] += 1
                        print(f"SUCCESS (STORAGE): [{idx}] {ch['title']} ({len(blocks)} blocks)")
                    else:
                        # Storage unavailable/full — save to DB instead
                        cur.execute("DELETE FROM public.contents WHERE chapter_id = %s", (cid,))
                        conn.commit()
                        insert_queue.put((cid, blocks))
                        with stats_lock:
                            stats['db_saved'] += 1
                        print(f"SUCCESS (DB): [{idx}] {ch['title']} ({len(blocks)} blocks)")
                    
                    with stats_lock:
                        stats['scraped'] += 1
                else:
                    with stats_lock:
                        stats['skipped'] += 1
                    print(f"SKIPPING: [{idx}] {ch['title']} - No content found (Cloudflare or empty page)")

            except Exception as e:
                with stats_lock:
                    stats['failed'] += 1
                print(f"FAILED on {ch['title']}: {e}")

            q.task_done()

        browser.close()

    cur.close()
    db_pool.putconn(conn)


def get_chapters(novel_url):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        # Try navigating with a generous timeout and retries
        max_retries = 2
        for attempt in range(max_retries):
            try:
                # Use 'commit' for faster entry if domcontentloaded is hanging
                wait_strategy = "domcontentloaded" if attempt == 0 else "commit"
                timeout = 60000 if attempt == 0 else 90000
                
                print(f"Navigating to novel page (Attempt {attempt+1}, Strategy: {wait_strategy})...")
                page.goto(novel_url, timeout=timeout, wait_until=wait_strategy)
                break 
            except Exception as e:
                if attempt == max_retries - 1:
                    print(f"Fatal error navigating to {novel_url}: {e}")
                    browser.close()
                    raise e
                print(f"Retry navigating to {novel_url} due to: {e}")
                time.sleep(5)
        
        try:
            page.wait_for_selector('.wp-manga-chapter a', timeout=30000)
        except Exception as e:
            print(f"Warning: Timed out waiting for chapters to load: {e}")

        # Try to get title, fallback to URL part if page title fails
        try:
            title = page.title().split('-')[0].strip()
            if not title or title == "Just a moment...":
                 # Fallback for Cloudflare or empty titles
                 title = novel_url.split('/')[-2].replace('-', ' ').title()
        except:
            title = novel_url.split('/')[-2].replace('-', ' ').title()

        links = page.evaluate("""
        () => {
            let result = [];
            document.querySelectorAll('.wp-manga-chapter a').forEach(a => {
                result.push({
                    title: a.innerText.trim(),
                    url: a.href
                });
            });
            return result.reverse(); // oldest first
        }
        """)
        
        # Get cover if available
        cover_url = page.evaluate("""
        () => {
            const img = document.querySelector('.summary_image img');
            return img ? (img.dataset.src || img.src) : null;
        }
        """)

        browser.close()
        
        if not links:
            raise Exception(f"No chapters found for {novel_url}. Is the selector correct?")
            
        return title, cover_url, links


def get_or_create_novel(cur, title, url, cover_url):
    cur.execute(
        "INSERT INTO public.novels(title, url, cover_url) VALUES(%s, %s, %s) ON CONFLICT (url) DO UPDATE SET cover_url = EXCLUDED.cover_url RETURNING id",
        (title, url, cover_url)
    )
    res = cur.fetchone()
    if res:
        return res[0]
    
    cur.execute("SELECT id FROM public.novels WHERE url = %s", (url,))
    return cur.fetchone()[0]



def run(target_url=None):
    if not target_url:
        target_url = NOVEL_URL
        
    if not target_url or target_url in ("ALL_FORCE", "ALL"):
        is_force = (target_url == "ALL_FORCE")
        mode_str = "Full re-scrape (overwrite)" if is_force else "Smart sync (fill missing & new chapters)"
        # If no specific URL provided or 'ALL'/'ALL_FORCE', scrape all existing novels
        conn = db_pool.getconn()
        cur = conn.cursor()
        cur.execute("SELECT url FROM public.novels")
        urls = [row[0] for row in cur.fetchall()]
        cur.close()
        db_pool.putconn(conn)
        
        print(f"Found {len(urls)} novels to process. Mode: {mode_str}")
        for u in urls:
            try:
                print(f"\n--- Processing: {u} ---")
                run_single_novel(u, force=is_force)
            except Exception as e:
                print(f"SKIPPING NOVEL {u} due to error: {e}")
                continue
    else:
        is_force = target_url.startswith("FORCE:")
        clean_url = target_url.replace("FORCE:", "").strip()
        mode_str = "force overwrite" if is_force else "smart sync (fill missing/new)"
        print(f"Scraping single novel: {clean_url} [{mode_str}]")
        run_single_novel(clean_url, force=is_force)


def run_single_novel(novel_url, force=False):
    title, cover_url, chapters = get_chapters(novel_url)
    print(f"Found novel: {title} with {len(chapters)} chapters. Cover: {cover_url}")

    conn = db_pool.getconn()
    cur = conn.cursor()

    novel_id = get_or_create_novel(cur, title, novel_url, cover_url)
    conn.commit()

    # Check which chapters already have content in DB or Storage
    cur.execute("""
        SELECT chapter_index FROM public.chapters 
        WHERE novel_id = %s 
          AND (is_scraped = true OR EXISTS (SELECT 1 FROM public.contents cont WHERE cont.chapter_id = chapters.id LIMIT 1))
    """, (novel_id,))
    completed_indices = set(row[0] for row in cur.fetchall())
    
    if force:
        print(f"FORCING RE-SCRAPE: Overwriting contents for novel {title}.")
        completed_indices = set()
        
    print(f"Completed chapters: {len(completed_indices)} / {len(chapters)}")

    cur.close()
    db_pool.putconn(conn)

    q = queue.Queue()
    tasks_added = 0

    for i, ch in enumerate(chapters):
        chapter_idx = i + 1
        if chapter_idx not in completed_indices:
            q.put((chapter_idx, ch))
            tasks_added += 1

    if tasks_added == 0:
        print("No new chapters to scrape. Novel is up to date.")
        return

    # Reset stats for this novel
    with stats_lock:
        stats['scraped'] = 0
        stats['storage_saved'] = 0
        stats['db_saved'] = 0
        stats['failed'] = 0
        stats['skipped'] = 0

    print(f"Adding {tasks_added} new chapters to the queue.")

    writer_thread = threading.Thread(target=db_writer, daemon=True)
    writer_thread.start()

    threads = []
    for _ in range(WORKERS):
        t = threading.Thread(target=worker, args=(q, novel_id))
        t.start()
        threads.append(t)

    for t in threads:
        t.join()

    insert_queue.put(None)
    
    # Wait for db_writer to finish
    writer_thread.join()

    # Print summary
    with stats_lock:
        print(f"\n===== Summary for {title} =====")
        print(f"  Scraped:  {stats['scraped']}")
        print(f"  Storage:  {stats['storage_saved']}")
        print(f"  Database: {stats['db_saved']}")
        print(f"  Skipped:  {stats['skipped']}")
        print(f"  Failed:   {stats['failed']}")
    print(f"DONE for {title}\n")


if __name__ == "__main__":
    run()
