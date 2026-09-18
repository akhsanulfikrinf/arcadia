import os
import re
import sys
import time
import queue
import random
import threading
import requests
from html import unescape as html_unescape
import psycopg2
from psycopg2 import pool
from playwright.sync_api import sync_playwright
from utils.storage import SupabaseStorage

# --- curl_cffi setup with diagnostic logging ---
CFFI_AVAILABLE = False
CFFI_IMPERSONATE = None
cffi_session = None

try:
    from curl_cffi import requests as cffi_requests
    CFFI_AVAILABLE = True
    # Test which impersonate profiles are available
    for profile in ["chrome", "chrome120", "chrome110", "chrome100"]:
        try:
            cffi_session = cffi_requests.Session(impersonate=profile)
            CFFI_IMPERSONATE = profile
            break
        except Exception:
            continue
    if not cffi_session:
        # Session without impersonate as last resort
        cffi_session = cffi_requests.Session()
        print(f"WARNING: curl_cffi loaded but no impersonate profile available. Using plain session.")
    else:
        print(f"INFO: curl_cffi loaded successfully. Using impersonate profile: {CFFI_IMPERSONATE}")
except ImportError:
    print("WARNING: curl_cffi not installed. Falling back to requests (Cloudflare may block).")
except Exception as e:
    print(f"WARNING: curl_cffi failed to initialize: {e}. Falling back to requests.")

# Fallback: plain requests session
if cffi_session is None:
    cffi_session = requests.Session()
    cffi_session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
    })


def clean_database_url(raw_url: str) -> str:
    """Sanitize, unquote, and validate PostgreSQL connection URL."""
    if not raw_url:
        return ""
    
    url = raw_url.strip()
    
    # Strip quotes if wrapped: "..." or '...'
    while (url.startswith('"') and url.endswith('"')) or (url.startswith("'") and url.endswith("'")):
        url = url[1:-1].strip()
    
    # Strip 'psql ' if user copied the psql command directly from Supabase dashboard
    if url.startswith("psql "):
        url = url[5:].strip()
        while (url.startswith('"') and url.endswith('"')) or (url.startswith("'") and url.endswith("'")):
            url = url[1:-1].strip()

    # Strip 'DATABASE_URL=' if user copied assignment
    if url.startswith("DATABASE_URL="):
        url = url[13:].strip()
        while (url.startswith('"') and url.endswith('"')) or (url.startswith("'") and url.endswith("'")):
            url = url[1:-1].strip()

    # If password contains unescaped '#', encode it to '%23'
    m = re.match(r'^(postgres(?:ql)?://[^:]+:)([^@]+)(@.+)$', url)
    if m:
        prefix, password, suffix = m.groups()
        if '#' in password:
            password = password.replace('#', '%23')
            url = f"{prefix}{password}{suffix}"

    # Auto-reconstruct if only password was passed in DATABASE_URL secret
    if not (url.startswith("postgresql://") or url.startswith("postgres://")):
        if not ("@" in url or "host=" in url or " " in url):
            print("INFO: DATABASE_URL seems to contain only a password. Auto-reconstructing full Supabase connection string...")
            encoded_pw = url.replace('#', '%23')
            url = f"postgresql://postgres.nqcpkhmhozaxeyzryupk:{encoded_pw}@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres"
        else:
            raise ValueError(
                "DATABASE_URL secret is invalid: It must start with 'postgresql://'. "
                "Format: postgresql://postgres.nqcpkhmhozaxeyzryupk:<PASSWORD>@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres"
            )

    return url

# Configuration from environment variables
DATABASE_URL = clean_database_url(os.environ.get("DATABASE_URL", ""))
NOVEL_URL = os.environ.get("NOVEL_URL") # Provided via GitHub Actions dispatch
WORKERS = 1  # Single worker: prevents Cloudflare rate-limit flagging from concurrent requests
BATCH_SIZE = 5
MAX_CHAPTER_RETRIES = 3  # Retry failed chapters with exponential backoff

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
            elif t.startswith("\u201c") or t.startswith('"'):
                result.append({"type": "dialog", "content": t})
            else:
                result.append({"type": "paragraph", "content": t})

        elif b["type"] == "title":
            result.append({"type": "title", "content": b["content"]})
            
        elif b["type"] == "image":
            result.append(b)

    return result


def extract_blocks_from_html(html_text):
    """Parse .reading-content from HTML and return structured blocks."""
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html_text, 'html.parser')
    container = soup.select_one('.reading-content')
    if not container:
        return []

    blocks = []
    def walk(node):
        if not node:
            return
        if getattr(node, 'name', None) in ['script', 'style', 'iframe', 'noscript', 'a']:
            return
            
        if getattr(node, 'name', None) == 'img':
            src = node.get('data-src') or node.get('data-lazy-src') or node.get('src')
            if src and 'base64' not in src:
                blocks.append({'type': 'image', 'src': src})
            return
            
        if getattr(node, 'name', None) in ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']:
            t = node.get_text().strip()
            if t:
                blocks.append({'type': 'title', 'content': t})
            return
            
        if getattr(node, 'name', None) == 'p':
            imgs = node.find_all('img')
            if imgs:
                for child in node.children:
                    if hasattr(child, 'name') and child.name:
                        walk(child)
                    else:
                        t = str(child).strip()
                        if t and len(t) > 1:
                            blocks.append({'type': 'text', 'content': t})
            else:
                t = node.get_text().strip()
                if t:
                    blocks.append({'type': 'text', 'content': t})
            return
            
        for child in getattr(node, 'children', []):
            if hasattr(child, 'name') and child.name:
                walk(child)
            else:
                t = str(child).strip()
                if t and len(t) > 1:
                    blocks.append({'type': 'text', 'content': t})

    walk(container)
    return smart_split(blocks) if blocks else []


def cffi_get(url, timeout=20):
    """Make a GET request using curl_cffi session (with impersonation if available)."""
    if CFFI_IMPERSONATE:
        return cffi_session.get(url, timeout=timeout)
    else:
        return cffi_session.get(url, timeout=timeout)


def cffi_post(url, headers=None, timeout=20):
    """Make a POST request using curl_cffi session (with impersonation if available)."""
    if CFFI_IMPERSONATE:
        return cffi_session.post(url, headers=headers, timeout=timeout)
    else:
        return cffi_session.post(url, headers=headers, timeout=timeout)


def scrape_chapter(url):
    """Scrape a single chapter with retry + exponential backoff.
    
    Uses curl_cffi with TLS impersonation (no Playwright fallback — Playwright 
    from datacenter IPs always gets Cloudflare-blocked anyway).
    """
    base_delay = 2.0
    
    for attempt in range(MAX_CHAPTER_RETRIES):
        try:
            # Jitter delay: increases with each retry
            delay = random.uniform(0.5, 1.5) + (base_delay * attempt)
            time.sleep(delay)
            
            r = cffi_get(url, timeout=20)
            
            if r.status_code == 200:
                if 'Just a moment' in r.text:
                    print(f"  [CFFI] Cloudflare challenge detected (attempt {attempt+1}/{MAX_CHAPTER_RETRIES})")
                    if attempt < MAX_CHAPTER_RETRIES - 1:
                        backoff = base_delay * (2 ** attempt) + random.uniform(1, 3)
                        print(f"  [CFFI] Backing off {backoff:.1f}s...")
                        time.sleep(backoff)
                    continue
                
                if 'reading-content' not in r.text:
                    print(f"  [CFFI] No .reading-content found (attempt {attempt+1}/{MAX_CHAPTER_RETRIES})")
                    continue
                
                blocks = extract_blocks_from_html(r.text)
                if blocks and len(blocks) > 0:
                    if attempt > 0:
                        print(f"  [CFFI] Succeeded on retry {attempt+1}")
                    return blocks
                else:
                    print(f"  [CFFI] Empty blocks after parsing (attempt {attempt+1})")
            else:
                print(f"  [CFFI] HTTP {r.status_code} (attempt {attempt+1}/{MAX_CHAPTER_RETRIES})")
                if attempt < MAX_CHAPTER_RETRIES - 1:
                    backoff = base_delay * (2 ** attempt) + random.uniform(1, 3)
                    time.sleep(backoff)
                    
        except Exception as e:
            print(f"  [CFFI] Error: {e} (attempt {attempt+1}/{MAX_CHAPTER_RETRIES})")
            if attempt < MAX_CHAPTER_RETRIES - 1:
                backoff = base_delay * (2 ** attempt) + random.uniform(1, 3)
                time.sleep(backoff)
    
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
    chapter_ids = []
    for chapter_id, blocks in batch:
        chapter_ids.append(chapter_id)
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
        cur.execute(
            "UPDATE public.chapters SET is_scraped = true WHERE id = ANY(%s)",
            (chapter_ids,)
        )


def worker(q, novel_id):
    conn = db_pool.getconn()
    cur = conn.cursor()

    # Check storage availability once per worker
    storage_full = storage.enabled and storage.is_storage_full()
    if storage_full:
        print("WARNING: Storage is near capacity. New content will be saved to database instead.")

    while True:
        try:
            idx, ch = q.get(timeout=3)
        except queue.Empty:
            break

        print(f"SCRAPE: [{idx}] {ch['title']}")

        try:
            blocks = scrape_chapter(ch["url"])
            
            if blocks and len(blocks) > 0:
                # Upsert chapter metadata (without marking is_scraped yet)
                cur.execute(
                    "INSERT INTO public.chapters(novel_id, title, chapter_index) VALUES(%s, %s, %s) ON CONFLICT (novel_id, chapter_index) DO UPDATE SET title = EXCLUDED.title RETURNING id",
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
                    # Content is in storage — clean up DB contents and mark is_scraped = true
                    cur.execute("DELETE FROM public.contents WHERE chapter_id = %s", (cid,))
                    cur.execute("UPDATE public.chapters SET is_scraped = true WHERE id = %s", (cid,))
                    conn.commit()
                    with stats_lock:
                        stats['storage_saved'] += 1
                        stats['scraped'] += 1
                    print(f"SUCCESS (STORAGE): [{idx}] {ch['title']} ({len(blocks)} blocks)")
                else:
                    # Storage unavailable/full — save to DB instead
                    cur.execute("DELETE FROM public.contents WHERE chapter_id = %s", (cid,))
                    conn.commit()
                    insert_queue.put((cid, blocks))
                    with stats_lock:
                        stats['db_saved'] += 1
                        stats['scraped'] += 1
                    print(f"SUCCESS (DB): [{idx}] {ch['title']} ({len(blocks)} blocks)")
            else:
                with stats_lock:
                    stats['skipped'] += 1
                print(f"SKIPPING: [{idx}] {ch['title']} - No content found after {MAX_CHAPTER_RETRIES} attempts")

        except Exception as e:
            with stats_lock:
                stats['failed'] += 1
            print(f"FAILED on {ch['title']}: {e}")

        q.task_done()

    cur.close()
    db_pool.putconn(conn)


def get_chapters(novel_url):
    novel_url = novel_url.strip()
    
    # --- Strategy 1: curl_cffi with TLS browser impersonation ---
    try:
        print(f"[get_chapters] Trying curl_cffi (impersonate={CFFI_IMPERSONATE})...")
        r_main = cffi_get(novel_url, timeout=20)
        
        if r_main.status_code == 200 and 'Just a moment' not in r_main.text:
            canonical_url = str(r_main.url)
            html_text = r_main.text
            
            # Title extraction
            title = None
            m_title = re.search(r'<div[^>]*class=["\'][^"\']*post-title[^"\']*["\'][^>]*>[\s\S]*?<h[13][^>]*>([\s\S]*?)</h[13]>', html_text)
            if m_title:
                title = html_unescape(re.sub(r'<[^>]+>', '', m_title.group(1)).strip())
            if not title:
                m_head = re.search(r'<title>([^<]+)</title>', html_text)
                if m_head:
                    title = html_unescape(m_head.group(1).split('-')[0].strip())
            if not title or title == "Just a moment...":
                title = canonical_url.rstrip('/').split('/')[-1].replace('-', ' ').title()

            # Cover extraction
            cover_url = None
            m_cover = re.search(r'<div[^>]*class=["\'][^"\']*summary_image[^"\']*["\'][^>]*>[\s\S]*?<img[^>]+(?:data-src|data-lazy-src|src)=["\']([^"\']+)["\']', html_text)
            if m_cover:
                cover_url = m_cover.group(1)

            # Fetch chapters via Madara AJAX endpoint on CANONICAL URL
            ajax_url = canonical_url.rstrip('/') + '/ajax/chapters/'
            r_ch = cffi_post(ajax_url, headers={'X-Requested-With': 'XMLHttpRequest'}, timeout=20)
            ch_html = r_ch.text if (r_ch.status_code == 200 and len(r_ch.text) > 50) else html_text
            
            pattern = r'<li[^>]*class="[^"]*wp-manga-chapter[^"]*"[^>]*>[\s\S]*?<a[^>]+href=["\']([^"\']+)["\'][^>]*>([\s\S]*?)</a>'
            matches = re.findall(pattern, ch_html)

            if not matches:
                matches = re.findall(r'<a[^>]+href=["\'](https?://[^"\']*/(volume|chapter)[^"\']*)["\'][^>]*>([\s\S]*?)</a>', ch_html, re.IGNORECASE)
                # Fix: re.findall with 3 groups returns 3-tuples, extract href and title
                if matches and len(matches[0]) == 3:
                    matches = [(m[0], m[2]) for m in matches]

            if matches:
                links = []
                seen_urls = set()
                for href, raw_t in matches:
                    clean_t = html_unescape(re.sub(r'<[^>]+>', '', raw_t).strip())
                    if href not in seen_urls and clean_t:
                        seen_urls.add(href)
                        links.append({'title': clean_t, 'url': href})
                
                if links:
                    # In Madara /ajax/chapters/, newest is on top, so reverse to oldest first
                    links.reverse()
                    print(f"[CFFI] Found {len(links)} chapters for: {title}")
                    return title, cover_url, links
        else:
            status = r_main.status_code
            has_cf = 'Just a moment' in r_main.text
            print(f"[CFFI] Novel page failed: HTTP {status}, Cloudflare={has_cf}")
    except Exception as e:
        print(f"[CFFI] get_chapters failed: {type(e).__name__}: {e}")

    # --- Strategy 2: Playwright Headless Browser (Fallback with in-browser AJAX fetch) ---
    print("[get_chapters] Falling back to Playwright...")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        )
        
        try:
            # Try navigating with a generous timeout and retries
            max_retries = 2
            for attempt in range(max_retries):
                try:
                    wait_strategy = "domcontentloaded" if attempt == 0 else "commit"
                    timeout = 60000 if attempt == 0 else 90000
                    
                    print(f"Navigating to novel page (Attempt {attempt+1}, Strategy: {wait_strategy})...")
                    page.goto(novel_url, timeout=timeout, wait_until=wait_strategy)
                    break 
                except Exception as e:
                    if attempt == max_retries - 1:
                        print(f"Fatal error navigating to {novel_url}: {e}")
                        raise e
                    print(f"Retry navigating to {novel_url} due to: {e}")
                    time.sleep(5)
            
            # Wait 2 seconds for potential Cloudflare redirect
            time.sleep(2)

            # In-browser extraction with native async fetch & DOMParser (passes Cloudflare cookies!)
            extracted = page.evaluate("""async () => {
                // 1. Title
                let title = '';
                const titleEl = document.querySelector('.post-title h1, .post-title h3, h1');
                if (titleEl && titleEl.innerText.trim()) {
                    title = titleEl.innerText.trim();
                } else {
                    title = document.title.split('-')[0].trim();
                }

                // 2. Cover
                let cover_url = null;
                const img = document.querySelector('.summary_image img');
                if (img) {
                    cover_url = img.dataset.src || img.dataset.lazySrc || img.src;
                }

                // 3. Chapters via in-browser AJAX fetch (runs in browser context with session cookies)
                let chapters = [];
                try {
                    let ajaxUrl = window.location.href.replace(/\\/?$/, '/ajax/chapters/');
                    let resp = await fetch(ajaxUrl, {
                        method: 'POST',
                        headers: { 'X-Requested-With': 'XMLHttpRequest' }
                    });
                    if (resp.status === 200) {
                        let html = await resp.text();
                        let parser = new DOMParser();
                        let doc = parser.parseFromString(html, 'text/html');
                        let seen = new Set();
                        doc.querySelectorAll('.wp-manga-chapter a').forEach(a => {
                            let h = a.href;
                            let t = a.innerText.trim();
                            if (h && t && !seen.has(h)) {
                                seen.add(h);
                                chapters.push({ title: t, url: h });
                            }
                        });
                        if (chapters.length > 0) {
                            chapters.reverse();
                        }
                    }
                } catch(e) {}

                // 4. Fallback: inspect DOM directly if chapters are already present in page
                if (chapters.length === 0) {
                    let seen = new Set();
                    document.querySelectorAll('.wp-manga-chapter a').forEach(a => {
                        let h = a.href;
                        let t = a.innerText.trim();
                        if (h && t && !seen.has(h)) {
                            seen.add(h);
                            chapters.push({ title: t, url: h });
                        }
                    });
                    if (chapters.length > 0) {
                        chapters.reverse();
                    }
                }

                return { title, cover_url, chapters };
            }""")

            title = extracted.get('title') or novel_url.rstrip('/').split('/')[-1].replace('-', ' ').title()
            cover_url = extracted.get('cover_url')
            links = extracted.get('chapters') or []

            if not links:
                raise Exception(f"No chapters found for {novel_url}. Is the selector correct?")
                
            print(f"[Playwright] Successfully extracted {len(links)} chapters for: {title}")
            return title, cover_url, links
        finally:
            browser.close()


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
    
    # 1. Register all chapters upfront so DB and Admin UI immediately reflect the true chapter count (e.g. 110)
    cur.executemany(
        """
        INSERT INTO public.chapters (novel_id, title, chapter_index, is_scraped)
        VALUES (%s, %s, %s, false)
        ON CONFLICT (novel_id, chapter_index) DO UPDATE
        SET title = EXCLUDED.title
        """,
        [(novel_id, ch["title"], i + 1) for i, ch in enumerate(chapters)]
    )
    conn.commit()

    if force:
        print(f"FORCING RE-SCRAPE: Overwriting contents for novel {title}.")
        cur.execute("UPDATE public.chapters SET is_scraped = false WHERE novel_id = %s", (novel_id,))
        conn.commit()
        completed_indices = set()
    else:
        # Check which chapters already have content in DB or Storage
        cur.execute("""
            SELECT chapter_index FROM public.chapters 
            WHERE novel_id = %s 
              AND (is_scraped = true OR EXISTS (SELECT 1 FROM public.contents cont WHERE cont.chapter_id = chapters.id LIMIT 1))
        """, (novel_id,))
        completed_indices = set(row[0] for row in cur.fetchall())
        
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
