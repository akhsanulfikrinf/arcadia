import psycopg2
import os

DATABASE_URL = "postgresql://postgres.gikxddcdepmhmxovqcvd:Sucry_01%23@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres"
conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

cur.execute("SELECT contents.type, contents.content, contents.image_url FROM public.contents JOIN public.chapters ON contents.chapter_id = chapters.id WHERE chapters.title ILIKE '%Maomao%' and contents.type='image';")
rows = cur.fetchall()

print(f"Found {len(rows)} images")

for row in rows:
    print(row)

cur.close()
conn.close()
