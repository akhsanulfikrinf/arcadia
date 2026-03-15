import os
import re
import time
import queue
import random
import threading
import psycopg2
from psycopg2 import pool
from playwright.sync_api import sync_playwright

# Configuration from environment variables
DATABASE_URL = os.environ.get("DATABASE_URL")
NOVEL_URL = os.environ.get("NOVEL_URL") # Provided via GitHub Actions dispatch
WORKERS = 3
BATCH_SIZE = 80

# Configure Database Pool
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is required")

db_pool = psycopg2.pool.SimpleConnectionPool(
    1, 10,
    dsn=DATABASE_URL
)

insert_queue = queue.Queue()


def normalize(t):
    return re.sub(r'\s+', ' ', t).strip()


def smart_split(blocks):
    result = []
    buffer = ""

    def flush():
        nonlocal buffer
        if buffer.strip():
            result.append({"type": "paragraph", "content": buffer.strip()})
        buffer = ""

    for b in blocks:
        if b["type"] == "text":
            t = normalize(b["content"])

            if len(t) < 60 and t.upper() == t:
                flush()
                result.append({"type": "title", "content": t})
                continue

            if t.startswith("“") or t.startswith('"'):
                flush()
                result.append({"type": "dialog", "content": t})
                continue

            buffer += " " + t

        elif b["type"] == "image":
            flush()
            result.append(b)

    flush()
    return result


def scrape_chapter(page, url):
    page.goto(url, timeout=60000, wait_until="domcontentloaded")
    time.sleep(random.uniform(1, 2))

    blocks = page.evaluate("""
    () => {
        const container = document.querySelector('.reading-content');
        if (!container) return [];
        
        let result = [];

        function walk(node) {
            node.childNodes.forEach(n => {
                if (n.nodeType === Node.TEXT_NODE) {
                    let t = n.textContent.trim();
                    if (t) result.push({type:'text', content:t});
                } else if (n.nodeName === 'IMG') {
                    let src = n.dataset.src || n.src;
                    if (src) result.push({type:'image', src:src});
                } else {
                    walk(n);
                }
            });
        }

        walk(container);
        return result;
    }
    """)

    return smart_split(blocks)


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
    for chapter_id, blocks in batch:
        for pos, b in enumerate(blocks):
            cur.execute(
                "INSERT INTO public.contents(chapter_id, type, content, image_url, position) VALUES(%s, %s, %s, %s, %s) ON CONFLICT DO NOTHING",
                (
                    chapter_id,
                    b.get("type"),
                    b.get("content"),
                    b.get("src"),
                    pos
                )
            )


def worker(q, novel_id):
    conn = db_pool.getconn()
    cur = conn.cursor()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        while True:
            try:
                idx, ch = q.get(timeout=3)
            except queue.Empty:
                break

            print(f"SCRAPE: [{idx}] {ch['title']}")

            try:
                blocks = scrape_chapter(page, ch["url"])

                cur.execute(
                    "INSERT INTO public.chapters(novel_id, title, chapter_index) VALUES(%s, %s, %s) ON CONFLICT (novel_id, chapter_index) DO UPDATE SET title = EXCLUDED.title RETURNING id",
                    (novel_id, ch["title"], idx)
                )
                res = cur.fetchone()
                if res:
                    cid = res[0]
                    conn.commit()
                    insert_queue.put((cid, blocks))
                else:
                    # Retrieve the existing chapter id
                    cur.execute("SELECT id FROM public.chapters WHERE novel_id = %s AND chapter_index = %s", (novel_id, idx))
                    cid = cur.fetchone()[0]
                    conn.commit()
                    # If it already existed, we still overwrite contents by deleting old contents
                    cur.execute("DELETE FROM public.contents WHERE chapter_id = %s", (cid,))
                    conn.commit()
                    insert_queue.put((cid, blocks))

            except Exception as e:
                print(f"FAILED on {ch['title']}: {e}")

            q.task_done()

        browser.close()

    cur.close()
    db_pool.putconn(conn)


def get_chapters(novel_url):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(novel_url, timeout=60000, wait_until="domcontentloaded")

        title = page.title().split('-')[0].strip()

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
        return title, cover_url, links


def get_or_create_novel(cur, title, url, cover_url):
    cur.execute(
        "INSERT INTO public.novels(title, url, cover_url) VALUES(%s, %s, %s) ON CONFLICT (url) DO UPDATE SET title = EXCLUDED.title, cover_url = EXCLUDED.cover_url RETURNING id",
        (title, url, cover_url)
    )
    res = cur.fetchone()
    if res:
        return res[0]
    
    cur.execute("SELECT id FROM public.novels WHERE url = %s", (url,))
    return cur.fetchone()[0]


def get_latest_chapter_index(cur, novel_id):
    cur.execute("SELECT MAX(chapter_index) FROM public.chapters WHERE novel_id = %s", (novel_id,))
    res = cur.fetchone()
    return res[0] if res and res[0] is not None else 0


def run(target_url=None):
    if not target_url:
        target_url = NOVEL_URL
        
    if not target_url:
        # If no specific URL provided, scrape all existing novels for updates
        conn = db_pool.getconn()
        cur = conn.cursor()
        cur.execute("SELECT url FROM public.novels")
        urls = [row[0] for row in cur.fetchall()]
        cur.close()
        db_pool.putconn(conn)
        
        print(f"Found {len(urls)} novels to update.")
        for u in urls:
            print(f"Updating novel: {u}")
            run_single_novel(u)
    else:
        print(f"Scraping single novel: {target_url}")
        run_single_novel(target_url)


def run_single_novel(novel_url):
    title, cover_url, chapters = get_chapters(novel_url)
    print(f"Found novel: {title} with {len(chapters)} chapters. Cover: {cover_url}")

    conn = db_pool.getconn()
    cur = conn.cursor()

    novel_id = get_or_create_novel(cur, title, novel_url, cover_url)
    conn.commit()

    latest_index = get_latest_chapter_index(cur, novel_id)
    print(f"Latest chapter in DB is {latest_index}")

    cur.close()
    db_pool.putconn(conn)

    q = queue.Queue()
    tasks_added = 0

    for i, ch in enumerate(chapters):
        chapter_idx = i + 1
        if chapter_idx > latest_index:
            q.put((chapter_idx, ch))
            tasks_added += 1

    if tasks_added == 0:
        print("No new chapters to scrape. Novel is up to date.")
        return

    print(f"Adding {tasks_added} new chapters to the queue.")

    threading.Thread(target=db_writer, daemon=True).start()

    threads = []
    for _ in range(WORKERS):
        t = threading.Thread(target=worker, args=(q, novel_id))
        t.start()
        threads.append(t)

    for t in threads:
        t.join()

    insert_queue.put(None)
    
    # Allow db_writer to finish
    time.sleep(1)

    print(f"DONE OPTIMIZED for {title}")


if __name__ == "__main__":
    run()
