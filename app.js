'use strict';

/*
  PFM Broadcasts — PocketBase self-hosted edition
  ------------------------------------------------------------
  Mobile-first PWA. The PocketBase server handles:
  - Admin auth (email/password + forgot password)
  - Broadcast CRUD + file uploads
  - Read receipts
  - Realtime subscriptions (SSE)

  When PocketBase is unreachable the app falls back to
  localStorage demo mode (single device, same-browser tabs).
*/

// ── config ────────────────────────────────────────────────
// Set PB_URL to your PocketBase server address.
// Local dev:  'http://127.0.0.1:8090'
// Production: 'https://pb.yourdomain.com'  (behind nginx/caddy/Cloudflare Tunnel)
// Set via ?pb_url=https://your-tunnel.trycloudflare.com, saved to localStorage
let PB_URL = localStorage.getItem('pfm_pb_url') || 'https://postposted-pockets-midwest-flows.trycloudflare.com';
const qp = new URLSearchParams(window.location.search);
if (qp.get('pb_url')) { PB_URL = qp.get('pb_url'); localStorage.setItem('pfm_pb_url', PB_URL); history.replaceState(null, '', window.location.pathname + window.location.hash); }

const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
if (isStandalone) document.body.classList.add('standalone');

// Listen for display-mode changes (e.g. after install)
window.matchMedia('(display-mode: standalone)').addEventListener('change', e => {
  if (e.matches) document.body.classList.add('standalone');
});

const STORAGE_KEY  = 'pfm_broadcasts_items_v5';
const DEVICE_KEY   = 'pfm_broadcasts_device_id_v5';
const CHANNEL_NAME = 'pfm_broadcasts_channel_v5';

const DEMO_ADMIN_EMAIL    = 'admin@pfm.co.za';
const DEMO_ADMIN_PASSWORD = 'PFM2026!';

const priorityWeight = { urgent:3, important:2, general:1 };
const localChannel   = 'BroadcastChannel' in window ? new BroadcastChannel(CHANNEL_NAME) : null;

let deferredInstallPrompt = null;
let pbUrl                 = '';            // active PocketBase URL (no trailing slash)
let liveMode              = false;         // true when PocketBase is reachable
let adminToken            = null;          // JWT from auth-with-password
let adminUser             = null;          // { id, email, role }
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
  lockAdminBtn:          document.querySelector('#lockAdminBtn'),
  broadcastForm:         document.querySelector('#broadcastForm'),
  title:                 document.querySelector('#title'),
  body:                  document.querySelector('#body'),
  seedBtn:               document.querySelector('#seedBtn'),
  clearBtn:              document.querySelector('#clearBtn'),
  installBtn:            document.querySelector('#installBtn'),
  installFromWelcomeBtn: document.querySelector('#installFromWelcomeBtn'),
  installSteps:         document.querySelector('#installSteps'),
  backendStatus:        document.querySelector('#backendStatus'),
  toast:                document.querySelector('#toast'),
  connectBar:           document.querySelector('#connectBar'),
  connectForm:          document.querySelector('#connectForm'),
  connectInput:         document.querySelector('#connectInput'),
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

function formatDate(iso) {
  return new Intl.DateTimeFormat('en-ZA', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }).format(new Date(iso));
}
function priorityLabel(p) { return { urgent:'Urgent', important:'Important', general:'General' }[p] || 'General'; }

function normaliseBroadcast(row) {
  return {
    id:        row.id,
    title:     row.title,
    body:      row.body || row.message,
    priority:  row.priority || 'general',
    createdAt: row.created || row.createdAt || row.created_at || new Date().toISOString(),
    createdBy: row.created_by || row.createdBy || null,
    readBy:    row.readBy || [],
    image:     row.image || null,
    isActive:  row.isActive ?? row.is_active ?? true,
  };
}

function isRead(item) {
  if (liveMode) return cachedReads.has(item.id);
  return Array.isArray(item.readBy) && item.readBy.includes(deviceId);
}

function sortBroadcasts(items) {
  return [...items].filter(i => i.isActive !== false).sort((a, b) => {
    const ar = isRead(a) ? 1 : 0, br = isRead(b) ? 1 : 0; if (ar !== br) return ar - br;
    const ap = priorityWeight[a.priority] || 0, bp = priorityWeight[b.priority] || 0; if (ap !== bp) return bp - ap;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
}

function isAdmin() { return liveMode && adminToken && adminUser && adminUser.role === 'admin'; }

// ── fetch helper ───────────────────────────────────────────

async function pbFetch(path, opts = {}) {
  const url = pbUrl + path;
  const hdrs = { ...opts.headers };
  if (adminToken) hdrs['Authorization'] = adminToken;
  let body = opts.body;
  if (body && !(body instanceof FormData)) {
    hdrs['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }
  const res = await fetch(url, { ...opts, headers: hdrs, body });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const e = await res.json(); msg = e.message || msg; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

// ── PocketBase live backend (raw fetch, zero SDK deps) ─────

async function probePocketBase() {
  if (!PB_URL) { els.connectBar?.classList.remove('hidden'); return false; }
  pbUrl = PB_URL.replace(/\/+$/, '');
  try {
    const r = await fetch(pbUrl + '/api/health').then(r => r.json());
    if (r.code !== 200) throw new Error('unhealthy');
    els.connectBar?.classList.add('hidden');
    // restore admin session if stored
    const tok = sessionStorage.getItem('pfm_admin_token');
    const usr = sessionStorage.getItem('pfm_admin_user');
    if (tok && usr) {
      try {
        adminToken = tok; adminUser = JSON.parse(usr);
        await pbFetch('/api/collections/users/records?perPage=1');
      } catch { adminToken = null; adminUser = null; sessionStorage.removeItem('pfm_admin_token'); sessionStorage.removeItem('pfm_admin_user'); }
    }
    return true;
  } catch (e) {
    console.warn('Backend probe failed:', e.message);
    els.connectBar?.classList.remove('hidden');
    return false;
  }
}

async function refreshFromLive() {
  if (!liveMode) return;
  try {
    const [bData, rData] = await Promise.all([
      pbFetch('/api/collections/broadcasts/records?perPage=500&filter=(is_active=true)&sort=-created'),
      pbFetch('/api/collections/broadcast_reads/records?perPage=500&filter=(device_id=\'' + deviceId + '\')')
    ]);
    cachedBroadcasts = (bData.items || []).map(normaliseBroadcast);
    cachedReads = new Set((rData.items || []).map(r => r.broadcast));
    render();
  } catch (e) { console.warn('Live refresh failed:', e.message); }
}

// polling — checks for new broadcasts every 3s
let pollingTimer = null;
let lastPollCreated = null;
function startPolling() {
  if (pollingTimer || !liveMode) return;
  pollingTimer = setInterval(async () => {
    if (!liveMode) return;
    try {
      const data = await pbFetch('/api/collections/broadcasts/records?perPage=1&sort=-created');
      const latest = data.items?.[0];
      if (latest && (!lastPollCreated || latest.created > lastPollCreated)) {
        lastPollCreated = latest.created;
        await refreshFromLive();
      }
    } catch { /* best effort */ }
  }, 3000);
}
function stopPolling() { if (pollingTimer) { clearInterval(pollingTimer); pollingTimer = null; } }

async function initBackend() {
  liveMode = await probePocketBase();
  if (liveMode) { await refreshFromLive(); startPolling(); return; }
  cachedBroadcasts = getLocalBroadcasts();
}

// ── localStorage (demo mode) ───────────────────────────────

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

// ── broadcasts ────────────────────────────────────────────

async function createBroadcast({ title, body, priority, imageFile }) {
  if (liveMode) {
    if (!isAdmin()) throw new Error('Admin access required');
    const fd = new FormData();
    fd.append('title', title);
    fd.append('message', body);
    fd.append('priority', priority || 'general');
    fd.append('created_by', adminUser.id);
    fd.append('is_active', 'true');
    if (imageFile) fd.append('image', imageFile);
    await fetch(pbUrl + '/api/collections/broadcasts/records', {
      method: 'POST',
      headers: adminToken ? { 'Authorization': adminToken } : {},
      body: fd
    }).then(r => { if (!r.ok) return r.json().then(e => { throw new Error(e.message); }); return r.json(); });
    lastPollCreated = new Date().toISOString();
    await refreshFromLive();
    return;
  }
  const item = normaliseBroadcast({ id:crypto.randomUUID?crypto.randomUUID():`${Date.now()}`, title, body, priority, createdAt:new Date().toISOString(), readBy:[], isActive:true });
  saveLocalBroadcasts([item, ...getLocalBroadcasts()]);
}

async function markRead(id) {
  if (liveMode) {
    try {
      await pbFetch('/api/collections/broadcast_reads/records', { method:'POST', body:{ broadcast:id, device_id:deviceId } });
    } catch (e) {
      if (e.message?.includes('400') || e.message?.includes('unique') || e.message?.includes('duplicate')) { /* already read, ok */ }
      else { console.error(e); showToast('Could not mark as read'); return; }
    }
    cachedReads.add(id); render(); showToast('Marked as read'); return;
  }
  const updated = getLocalBroadcasts().map(i => { if (i.id !== id) return i; const s = new Set(i.readBy||[]); s.add(deviceId); return {...i, readBy:Array.from(s)}; });
  saveLocalBroadcasts(updated); showToast('Marked as read');
}

// ── admin auth ────────────────────────────────────────────

async function doLogin(email, password) {
  const data = await pbFetch('/api/collections/users/auth-with-password', { method:'POST', body:{ identity:email, password } });
  adminToken = data.token;
  adminUser = { id: data.record.id, email: data.record.email, role: data.record.role };
  sessionStorage.setItem('pfm_admin_token', adminToken);
  sessionStorage.setItem('pfm_admin_user', JSON.stringify(adminUser));
}

async function doLogout() {
  adminToken = null; adminUser = null;
  sessionStorage.removeItem('pfm_admin_token'); sessionStorage.removeItem('pfm_admin_user');
  showLoginForm(false); renderAdminState(); showToast('Admin locked');
}

async function doForgotPassword(email) {
  await pbFetch('/api/collections/users/request-password-reset', { method:'POST', body:{ email } });
}

async function doResetPassword(token, password) {
  await pbFetch('/api/collections/users/confirm-password-reset', { method:'POST', body:{ token, password, passwordConfirm:password } });
}

// ── rendering ─────────────────────────────────────────────

function createPostCard(item) {
  const rd = isRead(item);
  const card = document.createElement('article');
  card.className = `post-card ${rd ? 'read' : 'unread'} ${sanitize(item.priority)}`;

  let imgHtml = '';
  if (item.image && liveMode && pbUrl) {
    const imgUrl = typeof item.image === 'string' ? item.image : (item.image.filename || item.image);
    imgHtml = `<img src="${pbUrl}/api/files/broadcasts/${item.id}/${imgUrl}" alt="" style="width:100%;max-height:300px;object-fit:cover;border-radius:12px;margin-bottom:8px" />`;
  }

  card.innerHTML = `
    <div class="post-top">
      <h3>${sanitize(item.title)}</h3>
      <span class="tag ${rd ? 'read' : sanitize(item.priority)}">${rd ? 'Read' : priorityLabel(item.priority)}</span>
    </div>
    ${imgHtml}
    <p>${sanitize(item.body)}</p>
    <div class="post-meta">
      <span>${formatDate(item.createdAt)}</span>
      <button class="${rd ? 'btn-secondary' : ''}" type="button" data-read-id="${sanitize(item.id)}">${rd ? 'Read again' : 'I have read this'}</button>
    </div>
  `;
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
  if (liveMode) {
    els.backendStatus.innerHTML = `<strong>Live backend (PocketBase)</strong><span>Connected to ${sanitize(pbUrl)}. Updates every 3 seconds.</span>`;
    return;
  }
  els.backendStatus.innerHTML = '<strong>Demo mode</strong><span>Using localStorage. Start PocketBase and configure PB_URL in app.js for cross-device broadcasting with unlimited images.</span>';
}

function showLoginForm(focus) {
  els.adminLoginForm?.classList.remove('hidden');
  els.resetPasswordForm?.classList.add('hidden');
  els.newPasswordForm?.classList.add('hidden');
  if (focus !== false) setTimeout(() => els.adminEmail?.focus(), 80);
}

function showResetForm() {
  els.adminLoginForm?.classList.add('hidden');
  els.resetPasswordForm?.classList.remove('hidden');
  els.newPasswordForm?.classList.add('hidden');
  els.resetEmail.value = els.adminEmail?.value || '';
  setTimeout(() => els.resetEmail?.focus(), 80);
}

function showNewPasswordForm() {
  els.adminLoginForm?.classList.add('hidden');
  els.resetPasswordForm?.classList.add('hidden');
  els.newPasswordForm?.classList.remove('hidden');
  setTimeout(() => els.newPassword?.focus(), 80);
}

function renderInstallSteps() {
  if (!els.installSteps) return;
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isAndroid = /android/i.test(navigator.userAgent);
  if (standalone) { els.installSteps.innerHTML = '<div><strong>Installed.</strong> PFM Broadcasts is already running from the home screen.</div>'; els.installBtn.disabled = true; els.installBtn.textContent = 'Already installed'; return; }
  if (deferredInstallPrompt) { els.installSteps.innerHTML = '<div><strong>Ready.</strong> Tap Install App and confirm the Android install prompt.</div>'; els.installBtn.disabled = false; els.installBtn.textContent = 'Install PFM Broadcasts'; return; }
  if (isAndroid) { els.installSteps.innerHTML = '<div><strong>Android Chrome:</strong> open the browser menu and choose Install app or Add to Home screen.</div><div>If the prompt does not show immediately, make sure this site is running on HTTPS.</div>'; els.installBtn.disabled = true; els.installBtn.textContent = 'Use Chrome menu'; return; }
  if (isIOS) { els.installSteps.innerHTML = '<div><strong>iPhone:</strong> open in Safari, tap Share, then choose Add to Home Screen.</div>'; els.installBtn.disabled = true; els.installBtn.textContent = 'Use Safari Share'; return; }
  els.installSteps.innerHTML = '<div><strong>Desktop:</strong> use the install icon in Chrome or Edge if it appears in the address bar.</div>'; els.installBtn.disabled = true; els.installBtn.textContent = 'Install option not shown yet';
}

function render() {
  if (isStandalone) document.body.classList.add('standalone');
  renderPosts();
  renderRecent();
  renderAdminState();
  renderInstallSteps();
}

function switchScreen(screen) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === `screen-${screen}`));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.screen === screen));
  if (screen === 'admin') renderAdminState();
  if (window.location.hash !== `#${screen}`) history.replaceState(null, '', `#${screen}`);
  window.scrollTo({ top:0, behavior:'smooth' });
}

// ── demo seed / clear ─────────────────────────────────────

function seedDemoPosts() {
  const now = Date.now();
  saveLocalBroadcasts([
    { id:crypto.randomUUID?crypto.randomUUID():`${now}-1`, title:'Price Update Effective Today', body:'New pricing is effective from today. Please make sure the latest information has been shared and followed.', priority:'urgent', createdAt:new Date(now).toISOString(), readBy:[], isActive:true },
    { id:crypto.randomUUID?crypto.randomUUID():`${now}-2`, title:'Holiday Schedule Notice', body:'Office support will be limited on the public holiday. Please check the latest schedule before planning follow-ups.', priority:'important', createdAt:new Date(now-28800000).toISOString(), readBy:[], isActive:true },
    { id:crypto.randomUUID?crypto.randomUUID():`${now}-3`, title:'New Product Launch', body:'A new product launch is planned for next week. More details will follow in the next broadcast.', priority:'general', createdAt:new Date(now-108000000).toISOString(), readBy:[], isActive:true },
  ].map(normaliseBroadcast));
  showToast('Demo posts added');
}

function clearDemoPosts() {
  if (liveMode) { showToast('Clear is disabled on live backend'); return; }
  saveLocalBroadcasts([]); showToast('Demo posts cleared');
}

// ── event binding ─────────────────────────────────────────

function bindEvents() {
  document.addEventListener('click', async e => {
    const s = e.target.closest('[data-screen]'); if (s) { switchScreen(s.dataset.screen); return; }
    const r = e.target.closest('[data-read-id]'); if (r) { await markRead(r.dataset.readId); }
  });

  // admin login
  els.adminLoginForm?.addEventListener('submit', async e => {
    e.preventDefault();
    const email = els.adminEmail.value.trim(), password = els.adminPassword.value;
    if (liveMode) {
      try { await doLogin(email, password); if (!isAdmin()) { doLogout(); showToast('This account is not an admin'); return; } showToast('Admin unlocked'); renderAdminState(); } catch (err) { showToast('Login failed'); }
      return;
    }
    if (email.toLowerCase() === DEMO_ADMIN_EMAIL && password === DEMO_ADMIN_PASSWORD) { sessionStorage.setItem('pfm_demo_admin','1'); renderAdminState(); showToast('Admin unlocked (demo)'); return; }
    showToast('Incorrect demo login');
  });

  // connect to server
  els.connectForm?.addEventListener('submit', async e => {
    e.preventDefault();
    const url = els.connectInput.value.trim();
    if (!url) return showToast('Paste your PocketBase server URL');
    PB_URL = url;
    localStorage.setItem('pfm_pb_url', url);
    liveMode = await probePocketBase();
    if (liveMode) {
      showToast('Connected! Loading posts...');
      await refreshFromLive();
      startPolling();
    } else {
      showToast('Could not reach that server. Check the URL and try again.');
    }
  });

  // forgot password
  els.resetPasswordForm?.addEventListener('submit', async e => {
    e.preventDefault(); const email = els.resetEmail.value.trim();
    if (liveMode) { try { await doForgotPassword(email); showToast('Reset email sent. Check your inbox.'); showLoginForm(false); } catch (err) { showToast(err.message || 'Could not send reset email'); } return; }
    showToast('Demo mode: start PocketBase to use password reset'); showLoginForm(false);
  });

  // set new password after reset link
  els.newPasswordForm?.addEventListener('submit', async e => {
    e.preventDefault(); const pw = els.newPassword.value;
    if (!liveMode) { showToast('Connect to PocketBase to update password'); return; }
    const token = new URLSearchParams(window.location.hash.split('?')[1] || '').get('token');
    if (!token) { showToast('No reset token found in URL'); return; }
    try { await doResetPassword(token, pw); showToast('Password updated. You may now log in.'); showLoginForm(false); } catch (err) { showToast(err.message || 'Could not reset password'); }
  });

  // broadcast form
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

  // password reset from URL hash
  const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
  if (hashParams.get('token')) { showNewPasswordForm(); switchScreen('admin'); }
}

// ── service worker ────────────────────────────────────────

async function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  try { await navigator.serviceWorker.register('./sw.js'); } catch (e) { console.warn('SW registration failed', e); }
}

// ── boot ──────────────────────────────────────────────────

async function startApp() {
  bindEvents();
  await initBackend();
  render();
  const initial = (window.location.hash.replace('#','').split('?')[0]) || 'welcome';
  if (document.querySelector(`#screen-${initial}`)) switchScreen(initial);
  await registerSW();
}

startApp();
