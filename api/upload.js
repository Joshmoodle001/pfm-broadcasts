export const config = { runtime: 'edge' };

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bmzzbtwhxhijueudznuk.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, content-type' }
  });
}

async function requireAdmin(request) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) throw new Error('Missing auth');
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${token}` } });
  const user = await r.json();
  if (!user?.id) throw new Error('Invalid session');
  const c = await fetch(`${SUPABASE_URL}/rest/v1/admin_profiles?select=is_admin&user_id=eq.${user.id}&is_admin=eq.true&limit=1`, { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } });
  const check = await c.json();
  if (!Array.isArray(check) || !check.length) throw new Error('Not admin');
  return user;
}

export default async function handler(request) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, content-type' } });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const user = await requireAdmin(request);
    const body = await request.json();
    const fileName = String(body.fileName || '').trim();
    if (!fileName) return json({ error: 'Missing fileName' }, 400);

    const ext = fileName.split('.').pop();
    const path = `broadcasts/${Date.now()}.${ext}`;

    const signed = await (await fetch(`${SUPABASE_URL}/storage/v1/object/upload/sign/media/${path}`, {
      method: 'POST',
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ upsert: true })
    })).json();

    if (!signed.url) return json({ error: 'Failed to get upload URL' }, 500);

    return json({
      uploadUrl: `${SUPABASE_URL}/storage/v1${signed.url}`,
      publicUrl: `${SUPABASE_URL}/storage/v1/object/public/media/${path}`
    });
  } catch (e) {
    return json({ error: e.message }, e.status || 500);
  }
}
