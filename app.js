'use strict';

/*
  PFM Broadcasts — Supabase + PocketBase dual-backend
  ------------------------------------------------------------
  Uses Supabase (auth, realtime, DB) when configured.
  Falls back to PocketBase or demo mode when not.
*/

// ── Supabase config ────────────────────────────────────────
const SUPABASE_URL = 'https://bmzbtwhxhhijueudznuk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtenpidHdoeGhpanVldWR6bnVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MDQzMzIsImV4cCI6MjA5NzM4MDMzMn0.K8r4XYMrSnCXQ4j_FJw7J4cbzuQ9O1RToDsmCUyLQSM';

// ── PocketBase fallback config ─────────────────────────────
let PB_URL = localStorage.getItem('pfm_pb_url') || 'http://192.168.70.61:8090';

const STORAGE_KEY  = 'pfm_broadcasts_items_v5';
const DEVICE_KEY   = 'pfm_broadcasts_device_id_v5';
const CHANNEL_NAME = 'pfm_broadcasts_channel_v5';

const DEMO_ADMIN_EMAIL    = 'admin@pfm.co.za';
const DEMO_ADMIN_PASSWORD = 'PFM2026!';

const priorityWeight = { urgent:3, important:2, general:1 };
const localChannel   = 'BroadcastChannel' in window ? new BroadcastChannel(CHANNEL_NAME) : null;

let deferredInstallPrompt = null;
let supabase              = null;    // Supabase client
let liveMode              = false;   // 'supabase' | 'pocketbase' | false
let realtimeChannel       = null;
let cachedBroadcasts      = [];
let cachedReads           = new Set();

// ── DOM refs ──────────────────────────────────────────────

const els = {
  postsList:             document.querySelector('#postsList'),
  postCount:             document.querySelector('#postCount'),
  recentList:            document.querySelector('#recentList'),
  adminLoginCard:        document.querySelector('#adminLoginCard'),
  adminCenter:           document.querySelector('#adminCenter'),
  adminLoginForm:        document.querySelector('#adminLoginForm'),
  adminEmail:            document.querySelector('#adminEmail'),
  adminPassword:         document.querySelector('#adminPassword'),
  resetPasswordForm:     document.querySelector('#resetPasswordForm'),
  resetEmail:            document.querySelector('#resetEmail'),
  newPasswordForm:       document.querySelector('#newPasswordForm'),
  newPassword:           document.querySelector('#newPassword'),
  showResetBtn:          document.querySelector('#showResetBtn'),
  backToLoginBtn:        document.querySelector('#backToLoginBtn'),
  showSignupBtn:         document.querySelector('#showSignupBtn'),
  signupForm:            document.querySelector('#signupForm'),
  signupEmail:           document.querySelector('#signupEmail'),
  signupPassword:        document.querySelector('#signupPassword'),
  backToLoginFromSignup: document.querySelector('#backToLoginFromSignup'),
  addAdminForm:          document.querySelector('#addAdminForm'),
  newAdminEmail:         document.querySelector('#newAdminEmail'),
  newAdminPassword:      document.querySelector('#newAdminPassword'),
  lockAdminBtn:          document.querySelector('#lockAdminBtn'),
  broadcastForm:         document.querySelector('#broadcastForm'),
  title:                document.querySelector('#title'),
  body:                 document.querySelector('#body'),
  seedBtn:               document.querySelector('#seedBtn'),
  clearBtn:              document.querySelector('#clearBtn'),
  installBtn:            document.querySelector('#installBtn'),
  installFromWelcomeBtn: document.querySelector('#installFromWelcomeBtn'),
  installSteps:          document.querySelector('#installSteps'),
  backendStatus:         document.querySelector('#backendStatus'),
  toast:                 document.querySelector('#toast'),
  statusDot:             document.querySelector('#statusDot'),
  statusLabel:           document.querySelector('#statusLabel'),
};

// ── helpers ───────────────────────────────────────────────

function getDeviceId() {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) { id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`; localStorage.setItem(DEVICE_KEY, id); }
  return id;
}
const deviceId = getDeviceId();

function sanitize(text) { const d = document.createElement('div'); d.textContent = text || ''; return d.innerHTML; }
let toastTimer;
function showToast(msg) { els.toast.textContent = msg; els.toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => els.toast.classList.remove('show'), 2400); }
function formatDate(iso) { return new Intl.DateTimeFormat('en-ZA', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }).format(new Date(iso)); }
function priorityLabel(p) { return { urgent:'Urgent', important:'Important', general:'General' }[p] || 'General'; }

function normaliseBroadcast(row) {
  return {
    id:        row.id,
    title:     row.title,
    body:      row.body || row.message || row.message,
    priority:  row.priority || 'general',
    createdAt: row.createdAt || row.created_at || row.created || new Date().toISOString(),
    createdBy: row.createdBy || row.created_by || null,
    readBy:    row.readBy || [],
    image:     row.image || null,
    isActive:  row.isActive ?? row.is_active ?? true,
  };
}

function isRead(item) {
  if (liveMode === 'supabase') return cachedReads.has(item.id);
  if (liveMode === 'pocketbase') return cachedReads.has(item.id);
  return Array.isArray(item.readBy) && item.readBy.includes(deviceId);
}

function sortBroadcasts(items) {
  return [...items].filter(i => i.isActive !== false).sort((a, b) => {
    const ar = isRead(a) ? 1 : 0, br = isRead(b) ? 1 : 0; if (ar !== br) return ar - br;
    const ap = priorityWeight[a.priority] || 0, bp = priorityWeight[b.priority] || 0; if (ap !== bp) return bp - ap;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
}

function setStatus(online) {
  if (els.statusDot) els.statusDot.style.background = online ? '#15803d' : '#d71920';
  if (els.statusLabel) els.statusLabel.textContent = online ? 'Connected' : 'Admin';
}

// ── localStorage (demo) ────────────────────────────────────

function getLocalBroadcasts() {
  try { const s = JSON.parse(localStorage.getItem(STORAGE_KEY)); return Array.isArray(s) ? s.map(normaliseBroadcast) : []; }
  catch { return []; }
}
function saveLocalBroadcasts(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  cachedBroadcasts = items.map(normaliseBroadcast);
  if (localChannel) localChannel.postMessage({ type:'broadcasts-updated' });
  render();
}

// ── Supabase backend ───────────────────────────────────────

function hasSupabaseConfig() {
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_URL.startsWith('https://') && window.supabase && typeof window.supabase.createClient === 'function');
}

async function initSupabase() {
  if (!hasSupabaseConfig()) return false;
  try {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { error } = await supabase.from('broadcasts').select('id').limit(1);
    if (error && (error.code === '42P01' || error.message?.includes('does not exist'))) {
      console.warn('Supabase tables not found. Run supabase_schema.sql in SQL Editor.');
      supabase = null; return false;
    }
    if (error) throw error;

    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        showNewPasswordForm(); switchScreen('admin'); return;
      }
      if (session?.user) {
        const { data } = await supabase.from('admin_profiles').select('is_admin').eq('user_id', session.user.id).eq('is_admin', true).maybeSingle();
        sessionStorage.setItem('pfm_supabase_admin', data ? '1' : '');
        if (!data) await supabase.auth.signOut();
      } else {
        sessionStorage.removeItem('pfm_supabase_admin');
      }
      renderAdminState();
    });

    const { data } = await supabase.auth.getSession();
    if (data?.session?.user) {
      const prof = await supabase.from('admin_profiles').select('is_admin').eq('user_id', data.session.user.id).eq('is_admin', true).maybeSingle();
      sessionStorage.setItem('pfm_supabase_admin', prof.data ? '1' : '');
      // Check if setup is complete (any admins exist)
      const { count } = await supabase.from('admin_profiles').select('*', { count:'exact', head:true }).eq('is_admin', true);
      els.showSignupBtn?.classList.toggle('hidden', (count || 0) > 0);
    }

    return true;
  } catch (e) {
    console.warn('Supabase init failed:', e.message);
    supabase = null;
    return false;
  }
}

async function refreshFromSupabase() {
  if (!supabase) return;
  const [bRes, rRes] = await Promise.all([
    supabase.from('broadcasts').select('*').eq('is_active', true).order('created_at', { ascending: false }).limit(200),
    supabase.from('broadcast_reads').select('broadcast_id').eq('device_id', deviceId)
  ]);
  if (!bRes.error) cachedBroadcasts = (bRes.data || []).map(normaliseBroadcast);
  if (!rRes.error) cachedReads = new Set((rRes.data || []).map(r => r.broadcast_id));
  render();
}

function subscribeSupabaseRealtime() {
  if (!supabase || realtimeChannel) return;
  realtimeChannel = supabase.channel('pfm-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'broadcasts' }, refreshFromSupabase)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'broadcast_reads' }, refreshFromSupabase)
    .subscribe();
}

function isSupabaseAdmin() { return sessionStorage.getItem('pfm_supabase_admin') === '1'; }

// ── PocketBase backend (fallback) ──────────────────────────

async function probePocketBase() {
  if (!PB_URL) return false;
  const url = PB_URL.replace(/\/+$/, '');
  try {
    const r = await fetch(url + '/api/health').then(r => r.json());
    if (r.code !== 200) throw new Error('unhealthy');
    return url;
  } catch (e) { console.warn('PB probe failed:', e.message); return false; }
}

async function refreshFromPocketBase(pbUrl) {
  try {
    const [bData, rData] = await Promise.all([
      fetch(pbUrl + '/api/collections/broadcasts/records?perPage=500&filter=(is_active=true)&sort=-created').then(r => r.json()),
      fetch(pbUrl + '/api/collections/broadcast_reads/records?perPage=500&filter=(device_id=\'' + deviceId + '\')').then(r => r.json())
    ]);
    cachedBroadcasts = (bData.items || []).map(normaliseBroadcast);
    cachedReads = new Set((rData.items || []).map(r => r.broadcast));
    render();
  } catch (e) { console.warn('PB refresh failed:', e.message); }
}

let pollTimer = null;
let lastPollCreated = null;
function startPBPolling(pbUrl) {
  if (pollTimer) return;
  pollTimer = setInterval(async () => {
    try {
      const d = await fetch(pbUrl + '/api/collections/broadcasts/records?perPage=1&sort=-created').then(r => r.json());
      const latest = d.items?.[0];
      if (latest && (!lastPollCreated || latest.created > lastPollCreated)) {
        lastPollCreated = latest.created;
        await refreshFromPocketBase(pbUrl);
      }
    } catch {}
  }, 3000);
}

// ── init backend ───────────────────────────────────────────

async function initBackend() {
  // Try Supabase first
  if (await initSupabase()) {
    liveMode = 'supabase';
    await refreshFromSupabase();
    subscribeSupabaseRealtime();
    setStatus(true);
    return;
  }

  // Try PocketBase fallback
  const pbUrl = await probePocketBase();
  if (pbUrl) {
    liveMode = 'pocketbase';
    PB_URL = pbUrl;
    await refreshFromPocketBase(pbUrl);
    startPBPolling(pbUrl);
    setStatus(true);
    return;
  }

  // Demo mode
  liveMode = false;
  setStatus(false);
  cachedBroadcasts = getLocalBroadcasts();
}

// ── broadcasts ────────────────────────────────────────────

async function createBroadcast({ title, body, priority, imageFile }) {
  if (liveMode === 'supabase') {
    if (!isSupabaseAdmin()) throw new Error('Admin required');
    const { error } = await supabase.from('broadcasts').insert({ title, message: body, priority, is_active: true });
    if (error) throw error;
    await refreshFromSupabase(); return;
  }
  if (liveMode === 'pocketbase') {
    if (!sessionStorage.getItem('pfm_pb_admin')) throw new Error('Admin required');
    const fd = new FormData();
    fd.append('title', title); fd.append('message', body); fd.append('priority', priority || 'general'); fd.append('is_active', 'true');
    if (imageFile) fd.append('image', imageFile);
    const token = sessionStorage.getItem('pfm_pb_token');
    await fetch(PB_URL + '/api/collections/broadcasts/records', { method:'POST', headers: token ? { Authorization: token } : {}, body: fd }).then(r => { if (!r.ok) return r.json().then(e => { throw new Error(e.message); }); });
    lastPollCreated = new Date().toISOString();
    await refreshFromPocketBase(PB_URL); return;
  }
  const item = normaliseBroadcast({ id:crypto.randomUUID?crypto.randomUUID():`${Date.now()}`, title, body, priority, createdAt:new Date().toISOString(), readBy:[], isActive:true });
  saveLocalBroadcasts([item, ...getLocalBroadcasts()]);
}

async function markRead(id) {
  if (liveMode === 'supabase') {
    await supabase.from('broadcast_reads').upsert({ broadcast_id: id, device_id: deviceId }, { onConflict: 'broadcast_id,device_id' });
    cachedReads.add(id); render(); showToast('Marked as read'); return;
  }
  if (liveMode === 'pocketbase') {
    try {
      const token = sessionStorage.getItem('pfm_pb_token');
      await fetch(PB_URL + '/api/collections/broadcast_reads/records', { method:'POST', headers: { 'Content-Type':'application/json', Authorization: token || '' }, body: JSON.stringify({ broadcast: id, device_id: deviceId }) }).then(r => { if (!r.ok) return r.json().then(e => { throw new Error(e.message); }); });
    } catch (e) { if (!e.message?.includes('400') && !e.message?.includes('unique')) { console.error(e); showToast('Could not mark as read'); return; } }
    cachedReads.add(id); render(); showToast('Marked as read'); return;
  }
  const updated = getLocalBroadcasts().map(i => { if (i.id !== id) return i; const s = new Set(i.readBy||[]); s.add(deviceId); return {...i, readBy:Array.from(s)}; });
  saveLocalBroadcasts(updated); showToast('Marked as read');
}

// ── admin auth ────────────────────────────────────────────

async function doLogin(email, password) {
  if (liveMode === 'supabase') {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const prof = await supabase.from('admin_profiles').select('is_admin').eq('user_id', data.user.id).eq('is_admin', true).maybeSingle();
    if (!prof.data) { await supabase.auth.signOut(); throw new Error('Not an approved admin'); }
    sessionStorage.setItem('pfm_supabase_admin', '1');
    return;
  }
  if (liveMode === 'pocketbase') {
    const data = await fetch(PB_URL + '/api/collections/users/auth-with-password', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ identity: email, password }) }).then(r => r.json());
    if (!data.token) throw new Error(data.message || 'Login failed');
    if (data.record?.role !== 'admin') throw new Error('Not an admin');
    sessionStorage.setItem('pfm_pb_token', data.token);
    sessionStorage.setItem('pfm_pb_admin', '1');
  }
}

function doLogout() {
  if (liveMode === 'supabase') supabase?.auth.signOut();
  sessionStorage.removeItem('pfm_supabase_admin');
  sessionStorage.removeItem('pfm_pb_token');
  sessionStorage.removeItem('pfm_pb_admin');
  showLoginForm(false); renderAdminState(); showToast('Admin locked');
}

function isAdmin() {
  if (liveMode === 'supabase') return isSupabaseAdmin();
  if (liveMode === 'pocketbase') return !!sessionStorage.getItem('pfm_pb_admin');
  return !!sessionStorage.getItem('pfm_demo_admin');
}

async function doForgotPassword(email) {
  if (liveMode === 'supabase') {
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname + '#admin' });
    return;
  }
  if (liveMode === 'pocketbase') {
    await fetch(PB_URL + '/api/collections/users/request-password-reset', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ email }) });
  }
}

async function doResetPassword(token, password) {
  if (liveMode === 'supabase') {
    await supabase.auth.updateUser({ password });
    return;
  }
  if (liveMode === 'pocketbase') {
    await fetch(PB_URL + '/api/collections/users/confirm-password-reset', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ token, password, passwordConfirm: password }) }).then(r => r.json());
  }
}

// ── standalone detection ───────────────────────────────────

const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
if (isStandalone) document.body.classList.add('standalone');

// ── rendering ─────────────────────────────────────────────

function createPostCard(item) {
  const rd = isRead(item);
  const card = document.createElement('article');
  card.className = `post-card ${rd ? 'read' : 'unread'} ${sanitize(item.priority)}`;
  let imgHtml = '';
  if (item.image && liveMode && typeof item.image === 'string') {
    const imgSrc = item.image.startsWith('http') ? item.image : (PB_URL + '/api/files/broadcasts/' + item.id + '/' + item.image);
    imgHtml = `<img src="${imgSrc}" alt="" style="width:100%;max-height:300px;object-fit:cover;border-radius:12px;margin-bottom:8px" />`;
  }
  card.innerHTML = `<div class="post-top"><h3>${sanitize(item.title)}</h3><span class="tag ${rd?'read':sanitize(item.priority)}">${rd?'Read':priorityLabel(item.priority)}</span></div>${imgHtml}<p>${sanitize(item.body)}</p><div class="post-meta"><span>${formatDate(item.createdAt)}</span><button class="${rd?'btn-secondary':''}" type="button" data-read-id="${sanitize(item.id)}">${rd?'Read again':'I have read this'}</button></div>`;
  return card;
}

function createRecentItem(item) {
  const el = document.createElement('div'); el.className = 'recent-item';
  el.innerHTML = `<strong>${sanitize(item.title)}</strong><span>${priorityLabel(item.priority)} - ${formatDate(item.createdAt)}</span>`;
  return el;
}

function renderPosts() {
  const items = sortBroadcasts(cachedBroadcasts);
  const unread = items.filter(i => !isRead(i)).length;
  els.postCount.textContent = items.length === 1 ? '1 post' : `${items.length} posts`;
  if (unread) els.postCount.textContent += ` - ${unread} unread`;
  els.postsList.innerHTML = '';
  if (!items.length) { els.postsList.innerHTML = '<div class="empty"><strong>No posts yet.</strong><p>When admin sends a broadcast, it will appear here.</p></div>'; return; }
  items.forEach(i => els.postsList.appendChild(createPostCard(i)));
}

function renderRecent() {
  if (!els.recentList) return;
  const items = [...cachedBroadcasts].sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt)).slice(0,5);
  els.recentList.innerHTML = '';
  if (!items.length) { els.recentList.innerHTML = '<div class="empty"><strong>No broadcasts sent yet.</strong></div>'; return; }
  items.forEach(i => els.recentList.appendChild(createRecentItem(i)));
}

function renderAdminState() {
  const unlocked = isAdmin();
  els.adminLoginCard?.classList.toggle('hidden', unlocked);
  els.adminCenter?.classList.toggle('hidden', !unlocked);
  renderBackendStatus();
}

function renderBackendStatus() {
  if (!els.backendStatus) return;
  if (liveMode === 'supabase') { els.backendStatus.innerHTML = '<strong>Supabase backend</strong><span>Live with realtime sync across all devices.</span>'; return; }
  if (liveMode === 'pocketbase') { els.backendStatus.innerHTML = '<strong>PocketBase backend</strong><span>Polling every 3 seconds for updates.</span>'; return; }
  els.backendStatus.innerHTML = '<strong>Demo mode</strong><span>Using localStorage. Configure Supabase or PocketBase for production.</span>';
}

function showLoginForm(focus) {
  els.adminLoginForm?.classList.remove('hidden'); els.resetPasswordForm?.classList.add('hidden'); els.newPasswordForm?.classList.add('hidden'); els.signupForm?.classList.add('hidden');
  if (focus !== false) setTimeout(() => els.adminEmail?.focus(), 80);
}
function showSignupForm() {
  els.adminLoginForm?.classList.add('hidden'); els.resetPasswordForm?.classList.add('hidden'); els.newPasswordForm?.classList.add('hidden'); els.signupForm?.classList.remove('hidden');
  setTimeout(() => els.signupEmail?.focus(), 80);
}
function showResetForm() {
  els.adminLoginForm?.classList.add('hidden'); els.resetPasswordForm?.classList.remove('hidden'); els.newPasswordForm?.classList.add('hidden');
  els.resetEmail.value = els.adminEmail?.value || ''; setTimeout(() => els.resetEmail?.focus(), 80);
}
function showNewPasswordForm() {
  els.adminLoginForm?.classList.add('hidden'); els.resetPasswordForm?.classList.add('hidden'); els.newPasswordForm?.classList.remove('hidden');
  setTimeout(() => els.newPassword?.focus(), 80);
}

function renderInstallSteps() {
  if (!els.installSteps) return;
  const standalone = isStandalone;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isAndroid = /android/i.test(navigator.userAgent);
  if (standalone) { els.installSteps.innerHTML = '<div><strong>Installed.</strong> PFM Broadcasts is already running from the home screen.</div>'; els.installBtn.disabled = true; els.installBtn.textContent = 'Already installed'; return; }
  if (deferredInstallPrompt) { els.installSteps.innerHTML = '<div><strong>Ready.</strong> Tap Install App and confirm the Android install prompt.</div>'; els.installBtn.disabled = false; els.installBtn.textContent = 'Install PFM Broadcasts'; return; }
  if (isAndroid) { els.installSteps.innerHTML = '<div><strong>Android Chrome:</strong> open the browser menu and choose Install app or Add to Home screen.</div>'; els.installBtn.disabled = true; els.installBtn.textContent = 'Use Chrome menu'; return; }
  if (isIOS) { els.installSteps.innerHTML = '<div><strong>iPhone:</strong> open in Safari, tap Share, then choose Add to Home Screen.</div>'; els.installBtn.disabled = true; els.installBtn.textContent = 'Use Safari Share'; return; }
  els.installSteps.innerHTML = '<div><strong>Desktop:</strong> use the install icon in Chrome or Edge if it appears in the address bar.</div>'; els.installBtn.disabled = true; els.installBtn.textContent = 'Install option not shown yet';
}

function render() {
  renderPosts(); renderRecent(); renderAdminState(); renderInstallSteps();
}

function switchScreen(screen) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === `screen-${screen}`));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.screen === screen));
  if (screen === 'admin') renderAdminState();
  if (window.location.hash !== `#${screen}`) history.replaceState(null, '', `#${screen}`);
  window.scrollTo({ top:0, behavior:'smooth' });
}

// ── demo seed/clear ────────────────────────────────────────

function seedDemoPosts() {
  const now = Date.now();
  saveLocalBroadcasts([
    { id:crypto.randomUUID?crypto.randomUUID():`${now}-1`, title:'Price Update Effective Today', body:'New pricing is effective from today.', priority:'urgent', createdAt:new Date(now).toISOString(), readBy:[], isActive:true },
    { id:crypto.randomUUID?crypto.randomUUID():`${now}-2`, title:'Holiday Schedule Notice', body:'Office support will be limited on the public holiday.', priority:'important', createdAt:new Date(now-28800000).toISOString(), readBy:[], isActive:true },
    { id:crypto.randomUUID?crypto.randomUUID():`${now}-3`, title:'New Product Launch', body:'A new product launch is planned for next week.', priority:'general', createdAt:new Date(now-108000000).toISOString(), readBy:[], isActive:true },
  ].map(normaliseBroadcast));
  showToast('Demo posts added');
}

function clearDemoPosts() {
  if (liveMode) { showToast('Clear disabled on live backend'); return; }
  saveLocalBroadcasts([]); showToast('Demo posts cleared');
}

// ── events ────────────────────────────────────────────────

function bindEvents() {
  document.addEventListener('click', async e => {
    const s = e.target.closest('[data-screen]'); if (s) { switchScreen(s.dataset.screen); return; }
    const r = e.target.closest('[data-read-id]'); if (r) { await markRead(r.dataset.readId); }
  });

  els.adminLoginForm?.addEventListener('submit', async e => {
    e.preventDefault();
    const email = els.adminEmail.value.trim(), password = els.adminPassword.value;
    if (liveMode) {
      try { await doLogin(email, password); showToast('Admin unlocked'); renderAdminState(); } catch (err) { showToast(err.message || 'Login failed'); }
      return;
    }
    if (email.toLowerCase() === DEMO_ADMIN_EMAIL && password === DEMO_ADMIN_PASSWORD) { sessionStorage.setItem('pfm_demo_admin','1'); renderAdminState(); showToast('Admin unlocked (demo)'); return; }
    showToast('Incorrect demo login');
  });

  els.resetPasswordForm?.addEventListener('submit', async e => {
    e.preventDefault(); const email = els.resetEmail.value.trim();
    if (liveMode) { try { await doForgotPassword(email); showToast('Reset email sent. Check your inbox.'); showLoginForm(false); } catch (err) { showToast(err.message); } return; }
    showToast('Connect backend to use password reset'); showLoginForm(false);
  });

  els.newPasswordForm?.addEventListener('submit', async e => {
    e.preventDefault(); const pw = els.newPassword.value;
    if (!liveMode) { showToast('Connect backend to update password'); return; }
    const token = new URLSearchParams(window.location.hash.split('?')[1] || '').get('token');
    if (!token && liveMode !== 'supabase') { showToast('No reset token'); return; }
    try { await doResetPassword(token, pw); showToast('Password updated.'); showLoginForm(false); } catch (err) { showToast(err.message); }
  });

  els.broadcastForm?.addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(els.broadcastForm);
    const title = String(fd.get('title')||'').trim(), body = String(fd.get('body')||'').trim(), priority = String(fd.get('priority')||'general');
    const imageFile = fd.get('image')?.size > 0 ? fd.get('image') : null;
    if (!title || !body) { showToast('Add a title and message'); return; }
    try { await createBroadcast({ title, body, priority, imageFile }); els.broadcastForm.reset(); els.broadcastForm.querySelector('input[name="priority"][value="important"]').checked = true; showToast('Broadcast sent'); switchScreen('posts'); }
    catch (err) { console.error(err); showToast(err.message || 'Could not send broadcast'); }
  });

  els.showResetBtn?.addEventListener('click', showResetForm);
  els.backToLoginBtn?.addEventListener('click', () => showLoginForm());
  els.showSignupBtn?.addEventListener('click', showSignupForm);
  els.backToLoginFromSignup?.addEventListener('click', () => showLoginForm());

  // add admin (super admin only)
  els.addAdminForm?.addEventListener('submit', async e => {
    e.preventDefault();
    if (liveMode !== 'supabase') { showToast('Only available on Supabase'); return; }
    const email = els.newAdminEmail.value.trim(), password = els.newAdminPassword.value;
    if (password.length < 8) { showToast('Password must be at least 8 characters'); return; }
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) { showToast(error.message); return; }
    if (!data.user) { showToast('Could not create user'); return; }
    await supabase.from('admin_profiles').insert({ user_id: data.user.id, full_name: email, is_admin: true });
    showToast('Admin added: ' + email);
    els.addAdminForm.reset();
  });

  // signup
  els.signupForm?.addEventListener('submit', async e => {
    e.preventDefault();
    const email = els.signupEmail.value.trim(), password = els.signupPassword.value;
    if (password.length < 8) { showToast('Password must be at least 8 characters'); return; }
    if (liveMode === 'supabase') {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) { showToast(error.message); return; }
      if (data.user?.identities?.length === 0) { showToast('This email is already registered.'); return; }
      showToast('Account created! First signup is auto-approved as admin. Check your email and log in.');
    } else {
      showToast('Connect Supabase backend to create accounts.');
    }
    showLoginForm(false);
  });
  els.lockAdminBtn?.addEventListener('click', doLogout);
  els.seedBtn?.addEventListener('click', seedDemoPosts);
  els.clearBtn?.addEventListener('click', clearDemoPosts);

  window.addEventListener('hashchange', () => {
    const screen = window.location.hash.replace('#','').split('?')[0] || 'welcome';
    if (document.querySelector(`#screen-${screen}`)) switchScreen(screen);
  });

  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstallPrompt = e; renderInstallSteps(); });
  window.addEventListener('appinstalled', () => { deferredInstallPrompt = null; showToast('PFM Broadcasts installed'); renderInstallSteps(); });

  async function promptInstall() {
    if (!deferredInstallPrompt) { renderInstallSteps(); switchScreen('install'); return; }
    deferredInstallPrompt.prompt(); await deferredInstallPrompt.userChoice; deferredInstallPrompt = null; renderInstallSteps();
  }
  els.installBtn?.addEventListener('click', promptInstall);
  els.installFromWelcomeBtn?.addEventListener('click', promptInstall);

  if (localChannel) localChannel.addEventListener('message', e => { if (e.data?.type==='broadcasts-updated' && !liveMode) { cachedBroadcasts = getLocalBroadcasts(); render(); } });

  const hp = new URLSearchParams(window.location.hash.split('?')[1] || '');
  if (hp.get('token')) { showNewPasswordForm(); switchScreen('admin'); }
}

// ── service worker ─────────────────────────────────────────

async function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  try { await navigator.serviceWorker.register('./sw.js'); } catch (e) { console.warn('SW registration failed', e); }
}

// ── boot ───────────────────────────────────────────────────

async function startApp() {
  bindEvents();
  await initBackend();
  render();
  const initial = (window.location.hash.replace('#','').split('?')[0]) || 'welcome';
  if (document.querySelector(`#screen-${initial}`)) switchScreen(initial);
  await registerSW();
}

startApp();
