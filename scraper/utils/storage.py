import os
import json
import requests


class SupabaseStorage:
    """Utility for uploading chapter content to Supabase Storage."""

    def __init__(self, supabase_url=None, service_role_key=None):
        self.key = service_role_key or os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')
        self.url = (supabase_url or os.environ.get('SUPABASE_URL', '')).rstrip('/')

        # If SUPABASE_URL is not provided, auto-derive from JWT or fallback to known project URL
        if not self.url and self.key:
            try:
                import base64
                parts = self.key.split('.')
                if len(parts) >= 2:
                    padded = parts[1] + '=' * (-len(parts[1]) % 4)
                    payload = json.loads(base64.urlsafe_b64decode(padded).decode('utf-8'))
                    if 'ref' in payload:
                        self.url = f"https://{payload['ref']}.supabase.co"
            except Exception:
                pass
            if not self.url:
                self.url = 'https://nqcpkhmhozaxeyzryupk.supabase.co'

        self.bucket = 'novel-contents'

        if not self.url or not self.key:
            print("WARNING: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set. Storage uploads will be skipped.")
            self.enabled = False
        else:
            self.enabled = True

    def _headers(self):
        return {
            'Authorization': f'Bearer {self.key}',
            'apikey': self.key,
        }

    def _storage_path(self, novel_id, chapter_id):
        return f'novels/{novel_id}/{chapter_id}.json'

    def upload_chapter(self, novel_id, chapter_id, content_blocks):
        """Upload chapter content as JSON to Supabase Storage.
        
        Args:
            novel_id: UUID string of the novel
            chapter_id: UUID string of the chapter
            content_blocks: List of dicts with keys: type, content, src, position
            
        Returns:
            True if upload succeeded, False otherwise
        """
        if not self.enabled:
            return False

        path = self._storage_path(novel_id, chapter_id)
        
        # Build clean JSON array
        json_data = []
        for pos, block in enumerate(content_blocks):
            item = {
                'type': block.get('type'),
                'position': pos,
            }
            if block.get('content'):
                item['content'] = block['content']
            if block.get('src'):
                item['image_url'] = block['src']
            json_data.append(item)

        json_bytes = json.dumps(json_data, ensure_ascii=False).encode('utf-8')

        # Try to upload (upsert)
        upload_url = f'{self.url}/storage/v1/object/{self.bucket}/{path}'
        headers = self._headers()
        headers['Content-Type'] = 'application/json'
        headers['x-upsert'] = 'true'

        try:
            resp = requests.post(upload_url, headers=headers, data=json_bytes, timeout=30)
            if resp.status_code in (200, 201):
                return True
            else:
                print(f"Storage upload failed ({resp.status_code}): {resp.text[:200]}")
                return False
        except Exception as e:
            print(f"Storage upload error: {e}")
            return False

    def check_exists(self, novel_id, chapter_id):
        """Check if a chapter JSON file exists in storage."""
        if not self.enabled:
            return False

        path = self._storage_path(novel_id, chapter_id)
        url = f'{self.url}/storage/v1/object/info/{self.bucket}/{path}'

        try:
            resp = requests.head(url, headers=self._headers(), timeout=10)
            return resp.status_code == 200
        except:
            return False

    def get_bucket_size(self):
        """Get approximate total size of the bucket in bytes.
        Returns -1 if unable to determine."""
        if not self.enabled:
            return -1

        url = f'{self.url}/storage/v1/object/list/{self.bucket}'
        headers = self._headers()
        headers['Content-Type'] = 'application/json'

        try:
            # List top-level (novels/) to get folder list
            resp = requests.post(url, headers=headers, json={
                'prefix': 'novels/',
                'limit': 10000,
            }, timeout=30)
            if resp.status_code != 200:
                return -1
            
            items = resp.json()
            total = sum(item.get('metadata', {}).get('size', 0) for item in items if item.get('metadata'))
            return total
        except:
            return -1

    def is_storage_full(self, limit_bytes=1_000_000_000):
        """Check if storage is approaching the limit (default 1GB).
        Uses a 90% threshold to be safe."""
        size = self.get_bucket_size()
        if size < 0:
            return False  # Can't determine, assume not full
        return size >= (limit_bytes * 0.9)
