import psycopg2
import os

DATABASE_URL = os.environ.get('DATABASE_URL')
if not DATABASE_URL:
    raise ValueError('DATABASE_URL environment variable is required')

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

cur.execute("SELECT contents.type, contents.content, contents.image_url FROM public.contents JOIN public.chapters ON contents.chapter_id = chapters.id WHERE chapters.title ILIKE '%Maomao%' and contents.type='image';")
rows = cur.fetchall()

print(f"Found {len(rows)} images")

for row in rows:
    print(row)

cur.close()
conn.close()
