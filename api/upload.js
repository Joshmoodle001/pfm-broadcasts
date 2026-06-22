export const config = { runtime: 'edge' };

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bmzzbtwhxhijueudznuk.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, content-type' }
  });
}

async function isAdmin(request) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return false;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${token}` } });
    const user = await r.json();
    if (!user?.id) return false;
    const c = await fetch(`${SUPABASE_URL}/rest/v1/admin_profiles?select=is_admin&user_id=eq.${user.id}&is_admin=eq.true&limit=1`, { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } });
    const check = await c.json();
    return Array.isArray(check) && check.length > 0;
  } catch { return false; }
}

export default async function handler(request) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, content-type' } });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!await isAdmin(request)) return json({ error: 'Admin auth required' }, 401);

  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!file) return json({ error: 'No file provided' }, 400);
    const ext = file.name.split('.').pop();
    const path = `broadcasts/${Date.now()}.${ext}`;
    const upload = await fetch(`${SUPABASE_URL}/storage/v1/object/media/${path}`, {
      method: 'POST',
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      body: file
    });
    if (!upload.ok) return json({ error: 'Storage upload failed' }, 500);
    return json({ publicUrl: `${SUPABASE_URL}/storage/v1/object/public/media/${path}` });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
