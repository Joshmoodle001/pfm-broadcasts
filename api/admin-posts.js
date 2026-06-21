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

async function softDeleteBroadcast(id) {
  const { url, key } = getConfig();
  const path = `${url}/rest/v1/broadcasts?id=eq.${encodeURIComponent(id)}`;
  const data = await fetchJson(path, {
    method: 'PATCH',
    headers: supabaseHeaders(key, {
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    }),
    body: JSON.stringify({ is_active: false })
  });
  return Array.isArray(data) ? data[0] || null : data;
}

async function clearAllBroadcasts() {
  const { url, key } = getConfig();
  return fetchJson(`${url}/rest/v1/broadcasts?is_active=eq.true`, {
    method: 'PATCH',
    headers: supabaseHeaders(key, {
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    }),
    body: JSON.stringify({ is_active: false })
  });
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: { Allow: 'DELETE, OPTIONS' }
      });
    }

    if (request.method !== 'DELETE') {
      return json({ error: 'Method not allowed' }, { status: 405, headers: { Allow: 'DELETE, OPTIONS' } });
    }

    try {
      await requireAdmin(request);
      const body = await request.json().catch(() => ({}));

      if (body.clearAll === true) {
        const cleared = await clearAllBroadcasts();
        return json({ clearedCount: Array.isArray(cleared) ? cleared.length : 0 });
      }

      const id = String(body.id || '').trim();
      if (!id) return json({ error: 'Missing broadcast id' }, { status: 400 });

      const deleted = await softDeleteBroadcast(id);
      return json({ deleted });
    } catch (error) {
      return json({ error: error.message || 'Delete failed' }, { status: error.status || 500 });
    }
  }
};
