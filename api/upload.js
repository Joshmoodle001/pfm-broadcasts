const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bmzzbtwhxhijueudznuk.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) return res.status(401).json({ error: 'Missing auth' });

    const ur = await (await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${token}` } })).json();
    if (!ur?.id) return res.status(401).json({ error: 'Invalid session' });
    const cp = await (await fetch(`${SUPABASE_URL}/rest/v1/admin_profiles?select=is_admin&user_id=eq.${ur.id}&is_admin=eq.true&limit=1`, { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } })).json();
    if (!Array.isArray(cp) || !cp.length) return res.status(403).json({ error: 'Not admin' });

    const fileName = String(req.body?.fileName || '').trim();
    if (!fileName) return res.status(400).json({ error: 'Missing fileName' });

    const ext = fileName.split('.').pop();
    const path = `broadcasts/${Date.now()}.${ext}`;
    const signed = await (await fetch(`${SUPABASE_URL}/storage/v1/object/upload/sign/media/${path}`, {
      method: 'POST',
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ upsert: true })
    })).json();

    if (!signed.url) return res.status(500).json({ error: 'Failed to get upload URL' });

    res.json({
      uploadUrl: `${SUPABASE_URL}/storage/v1${signed.url}`,
      publicUrl: `${SUPABASE_URL}/storage/v1/object/public/media/${path}`
    });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Upload failed' });
  }
}
