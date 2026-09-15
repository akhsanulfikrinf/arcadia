"""One-time migration script: Move contents from DB to Supabase Storage.

Usage:
    export DATABASE_URL='postgresql://...'
    export SUPABASE_URL='https://xxx.supabase.co'
    export SUPABASE_SERVICE_ROLE_KEY='eyJ...'
    python migrate_to_storage.py
"""
import os
import sys
import json
import psycopg2
from psycopg2.extras import RealDictCursor
from utils.storage import SupabaseStorage


def main():
    db_url = os.environ.get('DATABASE_URL')
    if not db_url:
        print('ERROR: DATABASE_URL is required')
        sys.exit(1)

    storage = SupabaseStorage()
    if not storage.enabled:
        print('ERROR: SUPABASE_SERVICE_ROLE_KEY (and optionally SUPABASE_URL) is required')
        sys.exit(1)

    conn = psycopg2.connect(db_url)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=RealDictCursor)

    # 1. Get all chapters that have content in the DB
    print('Fetching chapters with content...')
    cur.execute("""
        SELECT DISTINCT c.id as chapter_id, c.novel_id, c.title
        FROM public.chapters c
        JOIN public.contents cont ON cont.chapter_id = c.id
        ORDER BY c.novel_id, c.title
    """)
    chapters = cur.fetchall()
    total = len(chapters)
    print(f'Found {total} chapters with content to migrate.\n')

    if total == 0:
        print('Nothing to migrate!')
        return

    migrated = 0
    failed = 0
    skipped = 0

    for i, ch in enumerate(chapters):
        chapter_id = str(ch['chapter_id'])
        novel_id = str(ch['novel_id'])
        title = ch['title']

        progress = f'[{i+1}/{total}]'

        # Check if already in storage
        if storage.check_exists(novel_id, chapter_id):
            print(f'{progress} SKIP (already in storage): {title}')
            skipped += 1
            
            # Still mark as scraped and delete from DB since it's already migrated
            cur.execute('UPDATE public.chapters SET is_scraped = true WHERE id = %s', (chapter_id,))
            cur.execute('DELETE FROM public.contents WHERE chapter_id = %s', (chapter_id,))
            conn.commit()
            continue

        # Fetch content blocks from DB
        cur.execute("""
            SELECT type, content, image_url, position
            FROM public.contents
            WHERE chapter_id = %s
            ORDER BY position ASC
        """, (chapter_id,))
        rows = cur.fetchall()

        if not rows:
            print(f'{progress} SKIP (no content): {title}')
            skipped += 1
            continue

        # Build content blocks for storage
        blocks = []
        for row in rows:
            block = {'type': row['type'], 'position': row['position']}
            if row['content']:
                block['content'] = row['content']
            if row['image_url']:
                block['src'] = row['image_url']
            blocks.append(block)

        # Upload to storage
        success = storage.upload_chapter(novel_id, chapter_id, blocks)

        if success:
            # Mark chapter as scraped and delete content from DB
            cur.execute('UPDATE public.chapters SET is_scraped = true WHERE id = %s', (chapter_id,))
            cur.execute('DELETE FROM public.contents WHERE chapter_id = %s', (chapter_id,))
            conn.commit()
            migrated += 1
            print(f'{progress} MIGRATED: {title} ({len(blocks)} blocks)')
        else:
            failed += 1
            print(f'{progress} FAILED: {title}')
            conn.rollback()

    print(f'\n===== Migration Complete =====')
    print(f'Total chapters: {total}')
    print(f'Migrated: {migrated}')
    print(f'Skipped (already done): {skipped}')
    print(f'Failed: {failed}')

    cur.close()
    conn.close()


if __name__ == '__main__':
    main()
