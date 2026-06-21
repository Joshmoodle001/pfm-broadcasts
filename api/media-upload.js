const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'broadcast-media';
const MAX_MEDIA_BYTES = 50 * 1024 * 1024;
let bucketReady;

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...(init.headers || {})
    }
  });
}

function encodePath(path) {
  return path.split('/').map(encodeURIComponent).join('/');
}

function sanitizeFileSegment(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'media';
}

function getConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase server configuration');
  return { url, key };
}

function supabaseHeaders(key, extra = {}) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    ...extra
  };
}

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = data?.message || data?.error || `Request failed with ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return data;
}

async function ensureBucketExists() {
  if (bucketReady) return bucketReady;
  const { url, key } = getConfig();

  bucketReady = (async () => {
    const headers = supabaseHeaders(key, { 'Content-Type': 'application/json' });

    try {
      await fetchJson(`${url}/storage/v1/bucket/${BUCKET}`, {
        method: 'GET',
        headers
      });
      return;
    } catch (error) {
      if (error.status !== 404) throw error;
    }

    try {
      await fetchJson(`${url}/storage/v1/bucket`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: BUCKET,
          name: BUCKET,
          public: true,
          file_size_limit: MAX_MEDIA_BYTES,
          allowed_mime_types: [
            'image/jpeg',
            'image/png',
            'image/webp',
            'image/gif',
            'video/mp4',
            'video/webm',
            'video/quicktime'
          ]
        })
      });
    } catch (error) {
      if (error.status !== 409 && !/duplicate|already exists/i.test(error.message)) throw error;
    }
  })();

  return bucketReady;
}

async function requireAdmin(request) {
  const authHeader = request.headers.get('authorization') || '';
  const userToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!userToken) {
    const error = new Error('Missing admin session');
    error.status = 401;
    throw error;
  }

  const { url, key } = getConfig();
  const user = await fetchJson(`${url}/auth/v1/user`, {
    method: 'GET',
    headers: {
      apikey: key,
      Authorization: `Bearer ${userToken}`
    }
  });

  const adminCheck = await fetchJson(
    `${url}/rest/v1/admin_profiles?select=is_admin&user_id=eq.${encodeURIComponent(user.id)}&is_admin=eq.true&limit=1`,
    {
      method: 'GET',
      headers: supabaseHeaders(key)
    }
  );

  if (!Array.isArray(adminCheck) || !adminCheck.length) {
    const error = new Error('Admin approval required');
    error.status = 403;
    throw error;
  }

  return user;
}

function buildObjectPath(fileName, userId) {
  const cleanName = sanitizeFileSegment(fileName);
  const ext = cleanName.includes('.') ? cleanName.split('.').pop() : 'bin';
  const base = cleanName.replace(/\.[a-z0-9]+$/i, '').slice(0, 48) || 'media';
  return `admin/${sanitizeFileSegment(userId)}/${Date.now()}-${base}.${ext}`;
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          Allow: 'POST, OPTIONS'
        }
      });
    }

    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, { status: 405, headers: { Allow: 'POST, OPTIONS' } });
    }

    try {
      const body = await request.json();
      const fileName = String(body.fileName || '').trim();
      const contentType = String(body.contentType || '').trim();
      const size = Number(body.size || 0);

      if (!fileName || !contentType) return json({ error: 'Missing upload metadata' }, { status: 400 });
      if (!(contentType.startsWith('image/') || contentType.startsWith('video/'))) {
        return json({ error: 'Only image and video uploads are supported' }, { status: 400 });
      }
      if (!Number.isFinite(size) || size <= 0 || size > MAX_MEDIA_BYTES) {
        return json({ error: 'Files must be 50 MB or smaller' }, { status: 400 });
      }

      const user = await requireAdmin(request);
      await ensureBucketExists();

      const { url, key } = getConfig();
      const path = buildObjectPath(fileName, user.id);
      const signed = await fetchJson(`${url}/storage/v1/object/upload/sign/${BUCKET}/${encodePath(path)}`, {
        method: 'POST',
        headers: supabaseHeaders(key, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({ upsert: true })
      });

      return json({
        bucket: BUCKET,
        path,
        uploadUrl: `${url}/storage/v1${signed.url}`,
        publicUrl: `${url}/storage/v1/object/public/${BUCKET}/${encodePath(path)}`
      });
    } catch (error) {
      const status = error.status || 500;
      return json({ error: error.message || 'Upload signing failed' }, { status });
    }
  }
};
