"""Multi-threaded migration script: Move contents from DB to Supabase Storage.

Usage:
    export DATABASE_URL='postgresql://...'
    export SUPABASE_SERVICE_ROLE_KEY='eyJ...'
    python migrate_to_storage.py
"""
import os
import sys
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
import psycopg2
from psycopg2 import pool
from psycopg2.extras import RealDictCursor
from utils.storage import SupabaseStorage

NUM_WORKERS = 8


def process_chapter(ch, db_pool, storage, counter, total, lock):
    chapter_id = str(ch['chapter_id'])
    novel_id = str(ch['novel_id'])
    title = ch['title']

    conn = db_pool.getconn()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        # Check if already in storage
        if storage.check_exists(novel_id, chapter_id):
            cur.execute('UPDATE public.chapters SET is_scraped = true WHERE id = %s', (chapter_id,))
            cur.execute('DELETE FROM public.contents WHERE chapter_id = %s', (chapter_id,))
            conn.commit()
            with lock:
                counter['skipped'] += 1
                counter['done'] += 1
                curr = counter['done']
            print(f"[{curr}/{total}] SKIP (already in storage): {title}")
            return

        # Fetch contents
        cur.execute("""
            SELECT type, content, image_url, position
            FROM public.contents
            WHERE chapter_id = %s
            ORDER BY position ASC
        """, (chapter_id,))
        rows = cur.fetchall()

        if not rows:
            with lock:
                counter['skipped'] += 1
                counter['done'] += 1
                curr = counter['done']
            print(f"[{curr}/{total}] SKIP (empty): {title}")
            return

        blocks = []
        for row in rows:
            block = {'type': row['type'], 'position': row['position']}
            if row['content']:
                block['content'] = row['content']
            if row['image_url']:
                block['src'] = row['image_url']
            blocks.append(block)

        success = storage.upload_chapter(novel_id, chapter_id, blocks)
        if success:
            cur.execute('UPDATE public.chapters SET is_scraped = true WHERE id = %s', (chapter_id,))
            cur.execute('DELETE FROM public.contents WHERE chapter_id = %s', (chapter_id,))
            conn.commit()
            with lock:
                counter['migrated'] += 1
                counter['done'] += 1
                curr = counter['done']
            print(f"[{curr}/{total}] MIGRATED: {title} ({len(blocks)} blocks)")
        else:
            conn.rollback()
            with lock:
                counter['failed'] += 1
                counter['done'] += 1
                curr = counter['done']
            print(f"[{curr}/{total}] FAILED: {title}")
    except Exception as e:
        conn.rollback()
        with lock:
            counter['failed'] += 1
            counter['done'] += 1
            curr = counter['done']
        print(f"[{curr}/{total}] ERROR {title}: {e}")
    finally:
        cur.close()
        db_pool.putconn(conn)


def main():
    db_url = os.environ.get('DATABASE_URL')
    if not db_url:
        print('ERROR: DATABASE_URL is required')
        sys.exit(1)

    storage = SupabaseStorage()
    if not storage.enabled:
        print('ERROR: SUPABASE_SERVICE_ROLE_KEY is required')
        sys.exit(1)

    db_pool = psycopg2.pool.SimpleConnectionPool(
        1, NUM_WORKERS + 2,
        dsn=db_url
    )

    conn = db_pool.getconn()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    print('Fetching chapters with content from database...')
    cur.execute("""
        SELECT DISTINCT c.id as chapter_id, c.novel_id, c.title
        FROM public.chapters c
        JOIN public.contents cont ON cont.chapter_id = c.id
        ORDER BY c.novel_id, c.title
    """)
    chapters = cur.fetchall()
    total = len(chapters)
    print(f'Found {total} chapters with content to migrate.')
    print(f'Starting multi-threaded migration with {NUM_WORKERS} workers...\n')

    cur.close()
    db_pool.putconn(conn)

    if total == 0:
        print('Nothing to migrate! All content has already been moved to storage.')
        db_pool.closeall()
        return

    counter = {'migrated': 0, 'failed': 0, 'skipped': 0, 'done': 0}
    lock = threading.Lock()

    with ThreadPoolExecutor(max_workers=NUM_WORKERS) as executor:
        futures = [
            executor.submit(process_chapter, ch, db_pool, storage, counter, total, lock)
            for ch in chapters
        ]
        for future in as_completed(futures):
            future.result()

    print(f'\n===== Migration Complete =====')
    print(f'Total chapters: {total}')
    print(f'Migrated: {counter["migrated"]}')
    print(f'Skipped (already in storage or empty): {counter["skipped"]}')
    print(f'Failed: {counter["failed"]}')

    db_pool.closeall()


if __name__ == '__main__':
    main()
