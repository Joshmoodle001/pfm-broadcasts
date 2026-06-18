'use strict';

/*
  PFM Broadcasts — Supabase
  ------------------------------------------------------------
  Full Supabase backend: auth, realtime, database, RLS.
*/

const SUPABASE_URL = 'https://bmzbtwhxhhijueudznuk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtenpidHdoeGhpanVldWR6bnVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MDQzMzIsImV4cCI6MjA5NzM4MDMzMn0.K8r4XYMrSnCXQ4j_FJw7J4cbzuQ9O1RToDsmCUyLQSM';

const STORAGE_KEY  = 'pfm_broadcasts_items_v5';
const DEVICE_KEY   = 'pfm_broadcasts_device_id_v5';
const CHANNEL_NAME = 'pfm_broadcasts_channel_v5';

const DEMO_ADMIN_EMAIL    = 'admin@pfm.co.za';
const DEMO_ADMIN_PASSWORD = 'PFM2026!';
const priorityWeight = { urgent:3, important:2, general:1 };
const localChannel = 'BroadcastChannel' in window ? new BroadcastChannel(CHANNEL_NAME) : null;

let deferredInstallPrompt = null;
let supabase = null;
let liveMode = false;
let realtimeChannel = null;
let cachedBroadcasts = [];
let cachedReads = new Set();

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
  title:                 document.querySelector('#title'),
  body:                  document.querySelector('#body'),
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

function sanitize(t) { const d = document.createElement('div'); d.textContent = t || ''; return d.innerHTML; }
let tt; function showToast(m) { els.toast.textContent = m; els.toast.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => els.toast.classList.remove('show'), 2400); }
function formatDate(iso) { return new Intl.DateTimeFormat('en-ZA', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }).format(new Date(iso)); }
function priorityLabel(p) { return { urgent:'Urgent', important:'Important', general:'General' }[p] || 'General'; }

function normaliseBroadcast(row) {
  return {
    id: row.id, title: row.title, body: row.body || row.message,
    priority: row.priority || 'general',
    createdAt: row.created_at || row.createdAt || row.created || new Date().toISOString(),
    createdBy: row.created_by || row.createdBy || null,
    readBy: row.readBy || [], image: row.image || null,
    isActive: row.isActive ?? row.is_active ?? true,
  };
}

function isRead(item) {
  if (liveMode) return cachedReads.has(item.id);
  return Array.isArray(item.readBy) && item.readBy.includes(deviceId);
}

function sortBroadcasts(items) {
  return [...items].filter(i => i.isActive !== false).sort((a, b) => {
    const ar = isRead(a) ? 1 : 0, br = isRead(b) ? 1 : 0; if (ar !== br) return ar - br;
    const ap = priorityWeight[a.priority]||0, bp = priorityWeight[b.priority]||0; if (ap !== bp) return bp - ap;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
}

function setStatus(on) {
  if (els.statusDot) els.statusDot.style.background = on ? '#15803d' : '#d71920';
  if (els.statusLabel) els.statusLabel.textContent = on ? 'Connected' : 'Offline';
}

// ── demo mode ─────────────────────────────────────────────

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

// ── Supabase backend ──────────────────────────────────────

function hasSupabase() {
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase && typeof window.supabase.createClient === 'function');
}

async function initSupabase() {
  if (!hasSupabase()) return false;
  try {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') { showNewPasswordForm(); switchScreen('admin'); return; }
      if (session?.user) {
        const { data } = await supabase.from('admin_profiles').select('is_admin').eq('user_id', session.user.id).eq('is_admin', true).maybeSingle();
        sessionStorage.setItem('pfm_sb_admin', data ? '1' : '');
        if (!data) { await supabase.auth.signOut(); showToast('Not an approved admin'); }
      } else { sessionStorage.removeItem('pfm_sb_admin'); }
      renderAdminState();
    });

    const { data } = await supabase.auth.getSession();
    if (data?.session?.user) {
      const prof = await supabase.from('admin_profiles').select('is_admin').eq('user_id', data.session.user.id).eq('is_admin', true).maybeSingle();
      sessionStorage.setItem('pfm_sb_admin', prof.data ? '1' : '');
    }

    // Check if setup done
    const { count } = await supabase.from('admin_profiles').select('*', { count:'exact', head:true }).eq('is_admin', true);
    els.showSignupBtn?.classList.toggle('hidden', (count || 0) > 0);

    return true;
  } catch (e) {
    console.warn('Supabase init failed:', e.message);
    supabase = null; return false;
  }
}

async function refreshLive() {
  if (!supabase) return;
  const [bRes, rRes] = await Promise.all([
    supabase.from('broadcasts').select('*').eq('is_active', true).order('created_at', { ascending: false }).limit(200),
    supabase.from('broadcast_reads').select('broadcast_id').eq('device_id', deviceId)
  ]);
  if (!bRes.error) cachedBroadcasts = (bRes.data||[]).map(normaliseBroadcast);
  if (!rRes.error) cachedReads = new Set((rRes.data||[]).map(r => r.broadcast_id));
  render();
}

function subscribeRealtime() {
  if (!supabase || realtimeChannel) return;
  realtimeChannel = supabase.channel('pfm-live')
    .on('postgres_changes', { event:'*', schema:'public', table:'broadcasts' }, refreshLive)
    .on('postgres_changes', { event:'*', schema:'public', table:'broadcast_reads' }, refreshLive)
    .subscribe();
}

function isAdmin() { return liveMode && sessionStorage.getItem('pfm_sb_admin') === '1'; }

// ── broadcasts ────────────────────────────────────────────

async function createBroadcast({ title, body, priority, imageFile }) {
  if (liveMode) {
    if (!isAdmin()) throw new Error('Admin required');
    const { error } = await supabase.from('broadcasts').insert({ title, message:body, priority:priority||'general', is_active:true });
    if (error) throw error;
    await refreshLive(); return;
  }
  const item = normaliseBroadcast({ id:crypto.randomUUID?crypto.randomUUID():`${Date.now()}`, title, body, priority, createdAt:new Date().toISOString(), readBy:[], isActive:true });
  saveLocalBroadcasts([item, ...getLocalBroadcasts()]);
}

async function markRead(id) {
  if (liveMode) {
    await supabase.from('broadcast_reads').upsert({ broadcast_id:id, device_id:deviceId }, { onConflict:'broadcast_id,device_id' });
    cachedReads.add(id); render(); showToast('Marked as read'); return;
  }
  const updated = getLocalBroadcasts().map(i => { if (i.id!==id) return i; const s = new Set(i.readBy||[]); s.add(deviceId); return {...i, readBy:Array.from(s)}; });
  saveLocalBroadcasts(updated); showToast('Marked as read');
}

// ── auth ──────────────────────────────────────────────────

async function doLogin(email, pw) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password:pw });
  if (error) throw error;
  const prof = await supabase.from('admin_profiles').select('is_admin').eq('user_id', data.user.id).eq('is_admin', true).maybeSingle();
  if (!prof.data) { await supabase.auth.signOut(); throw new Error('Not an approved admin'); }
  sessionStorage.setItem('pfm_sb_admin', '1');
}

function doLogout() {
  supabase?.auth.signOut();
  sessionStorage.removeItem('pfm_sb_admin');
  showLoginForm(false); renderAdminState(); showToast('Admin locked');
}

async function doForgotPassword(email) {
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname + '#admin' });
}

async function doResetPassword(pw) {
  await supabase.auth.updateUser({ password:pw });
}

// ── standalone ────────────────────────────────────────────

const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
if (isStandalone) document.body.classList.add('standalone');

// ── rendering ─────────────────────────────────────────────

function createPostCard(item) {
  const rd = isRead(item);
  const c = document.createElement('article');
  c.className = `post-card ${rd?'read':'unread'} ${sanitize(item.priority)}`;
  c.innerHTML = `<div class="post-top"><h3>${sanitize(item.title)}</h3><span class="tag ${rd?'read':sanitize(item.priority)}">${rd?'Read':priorityLabel(item.priority)}</span></div><p>${sanitize(item.body)}</p><div class="post-meta"><span>${formatDate(item.createdAt)}</span><button class="${rd?'btn-secondary':''}" type="button" data-read-id="${sanitize(item.id)}">${rd?'Read again':'I have read this'}</button></div>`;
  return c;
}

function createRecentItem(item) {
  const el = document.createElement('div'); el.className = 'recent-item';
  el.innerHTML = `<strong>${sanitize(item.title)}</strong><span>${priorityLabel(item.priority)} - ${formatDate(item.createdAt)}</span>`;
  return el;
}

function renderPosts() {
  const items = sortBroadcasts(cachedBroadcasts);
  const unread = items.filter(i => !isRead(i)).length;
  els.postCount.textContent = items.length===1?'1 post':`${items.length} posts`;
  if (unread) els.postCount.textContent += ` - ${unread} unread`;
  els.postsList.innerHTML = '';
  if (!items.length) { els.postsList.innerHTML = '<div class="empty"><strong>No posts yet.</strong><p>When admin sends a broadcast, it will appear here.</p></div>'; return; }
  items.forEach(i => els.postsList.appendChild(createPostCard(i)));
}

function renderRecent() {
  if (!els.recentList) return;
  const items = [...cachedBroadcasts].sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt)).slice(0,5);
  els.recentList.innerHTML = items.length ? '' : '<div class="empty"><strong>No broadcasts yet.</strong></div>';
  items.forEach(i => els.recentList.appendChild(createRecentItem(i)));
}

function renderAdminState() {
  const unlocked = isAdmin();
  els.adminLoginCard?.classList.toggle('hidden', unlocked);
  els.adminCenter?.classList.toggle('hidden', !unlocked);
  if (els.backendStatus) {
    els.backendStatus.innerHTML = liveMode ? '<strong>Supabase backend</strong><span>Live with realtime sync across all devices.</span>' : '<strong>Demo mode</strong><span>Configure Supabase in app.js for production.</span>';
  }
}

function showLoginForm(f) {
  els.adminLoginForm?.classList.remove('hidden'); els.resetPasswordForm?.classList.add('hidden');
  els.newPasswordForm?.classList.add('hidden'); els.signupForm?.classList.add('hidden');
  if (f!==false) setTimeout(() => els.adminEmail?.focus(), 80);
}
function showResetForm() {
  els.adminLoginForm?.classList.add('hidden'); els.resetPasswordForm?.classList.remove('hidden');
  els.newPasswordForm?.classList.add('hidden'); els.signupForm?.classList.add('hidden');
  els.resetEmail.value = els.adminEmail?.value||''; setTimeout(() => els.resetEmail?.focus(), 80);
}
function showNewPasswordForm() {
  els.adminLoginForm?.classList.add('hidden'); els.resetPasswordForm?.classList.add('hidden');
  els.newPasswordForm?.classList.remove('hidden'); els.signupForm?.classList.add('hidden');
  setTimeout(() => els.newPassword?.focus(), 80);
}
function showSignupForm() {
  els.adminLoginForm?.classList.add('hidden'); els.resetPasswordForm?.classList.add('hidden');
  els.newPasswordForm?.classList.add('hidden'); els.signupForm?.classList.remove('hidden');
  setTimeout(() => els.signupEmail?.focus(), 80);
}

function renderInstallSteps() {
  if (!els.installSteps) return;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const android = /android/i.test(navigator.userAgent);
  if (isStandalone) { els.installSteps.innerHTML = '<div><strong>Installed.</strong> PFM Broadcasts is already on your home screen.</div>'; els.installBtn.disabled=true; els.installBtn.textContent='Installed'; return; }
  if (deferredInstallPrompt) { els.installSteps.innerHTML = '<div><strong>Ready.</strong> Tap to install.</div>'; els.installBtn.disabled=false; els.installBtn.textContent='Install PFM Broadcasts'; return; }
  if (android) { els.installSteps.innerHTML = '<div><strong>Chrome menu</strong> → Install app.</div>'; els.installBtn.disabled=true; els.installBtn.textContent='Use Chrome menu'; return; }
  if (ios) { els.installSteps.innerHTML = '<div><strong>Safari</strong> → Share → Add to Home Screen.</div>'; els.installBtn.disabled=true; els.installBtn.textContent='Use Safari Share'; return; }
  els.installSteps.innerHTML = '<div><strong>Desktop:</strong> use the install icon in the address bar.</div>'; els.installBtn.disabled=true; els.installBtn.textContent='Not available';
}

function render() { renderPosts(); renderRecent(); renderAdminState(); renderInstallSteps(); }

function switchScreen(s) {
  document.querySelectorAll('.screen').forEach(x => x.classList.toggle('active', x.id===`screen-${s}`));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.screen===s));
  if (s==='admin') renderAdminState();
  if (window.location.hash!==`#${s}`) history.replaceState(null, '', `#${s}`);
  window.scrollTo({ top:0, behavior:'smooth' });
}

// ── demo seed/clear ────────────────────────────────────────

function seedDemoPosts() {
  const n = Date.now();
  saveLocalBroadcasts([
    { id:crypto.randomUUID?crypto.randomUUID():`${n}-1`, title:'Price Update', body:'New pricing effective today.', priority:'urgent', createdAt:new Date(n).toISOString(), readBy:[], isActive:true },
    { id:crypto.randomUUID?crypto.randomUUID():`${n}-2`, title:'Holiday Schedule', body:'Office closed on public holiday.', priority:'important', createdAt:new Date(n-288e5).toISOString(), readBy:[], isActive:true },
    { id:crypto.randomUUID?crypto.randomUUID():`${n}-3`, title:'New Product', body:'Launching next week.', priority:'general', createdAt:new Date(n-108e6).toISOString(), readBy:[], isActive:true },
  ].map(normaliseBroadcast));
  showToast('Demo posts added');
}
function clearDemoPosts() {
  if (liveMode) { showToast('Disabled on live backend'); return; }
  saveLocalBroadcasts([]); showToast('Cleared');
}

// ── events ────────────────────────────────────────────────

function bindEvents() {
  document.addEventListener('click', async e => {
    const s = e.target.closest('[data-screen]'); if (s) { switchScreen(s.dataset.screen); return; }
    const r = e.target.closest('[data-read-id]'); if (r) { await markRead(r.dataset.readId); }
  });

  els.adminLoginForm?.addEventListener('submit', async e => {
    e.preventDefault();
    const email = els.adminEmail.value.trim(), pw = els.adminPassword.value;
    if (liveMode) { try { await doLogin(email, pw); showToast('Admin unlocked'); renderAdminState(); } catch (err) { showToast(err.message||'Login failed'); } return; }
    if (email.toLowerCase()===DEMO_ADMIN_EMAIL && pw===DEMO_ADMIN_PASSWORD) { sessionStorage.setItem('pfm_sb_admin','1'); renderAdminState(); showToast('Admin unlocked (demo)'); return; }
    showToast('Incorrect login');
  });

  els.resetPasswordForm?.addEventListener('submit', async e => {
    e.preventDefault();
    if (!liveMode) { showToast('Supabase backend required'); showLoginForm(false); return; }
    try { await doForgotPassword(els.resetEmail.value.trim()); showToast('Reset email sent'); showLoginForm(false); } catch (err) { showToast(err.message); }
  });

  els.newPasswordForm?.addEventListener('submit', async e => {
    e.preventDefault();
    if (!liveMode) { showToast('Supabase backend required'); return; }
    try { await doResetPassword(els.newPassword.value); showToast('Password updated'); showLoginForm(false); } catch (err) { showToast(err.message); }
  });

  els.showResetBtn?.addEventListener('click', showResetForm);
  els.backToLoginBtn?.addEventListener('click', () => showLoginForm());
  els.showSignupBtn?.addEventListener('click', showSignupForm);
  els.backToLoginFromSignup?.addEventListener('click', () => showLoginForm());

  els.signupForm?.addEventListener('submit', async e => {
    e.preventDefault();
    if (!liveMode) { showToast('Supabase backend required'); showLoginForm(false); return; }
    const email = els.signupEmail.value.trim(), pw = els.signupPassword.value;
    if (pw.length<8) { showToast('Password must be 8+ characters'); return; }
    const { data, error } = await supabase.auth.signUp({ email, password:pw });
    if (error) { showToast(error.message); return; }
    showToast('Account created! Log in now.');
    showLoginForm(false);
  });

  els.addAdminForm?.addEventListener('submit', async e => {
    e.preventDefault();
    if (!liveMode) { showToast('Supabase required'); return; }
    const email = els.newAdminEmail.value.trim(), pw = els.newAdminPassword.value;
    if (pw.length<8) { showToast('Password 8+ characters'); return; }
    const { data, error } = await supabase.auth.signUp({ email, password:pw });
    if (error) { showToast(error.message); return; }
    await supabase.from('admin_profiles').insert({ user_id:data.user.id, full_name:email, is_admin:true });
    showToast('Admin added: '+email); els.addAdminForm.reset();
  });

  els.broadcastForm?.addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(els.broadcastForm);
    const title = String(fd.get('title')||'').trim(), body = String(fd.get('body')||'').trim(), priority = String(fd.get('priority')||'general');
    if (!title||!body) { showToast('Title and message required'); return; }
    try { await createBroadcast({ title, body, priority }); els.broadcastForm.reset(); els.broadcastForm.querySelector('input[name="priority"][value="important"]').checked=true; showToast('Broadcast sent'); switchScreen('posts'); }
    catch (err) { console.error(err); showToast(err.message||'Failed'); }
  });

  els.lockAdminBtn?.addEventListener('click', doLogout);
  els.seedBtn?.addEventListener('click', seedDemoPosts);
  els.clearBtn?.addEventListener('click', clearDemoPosts);

  window.addEventListener('hashchange', () => {
    const s = window.location.hash.replace('#','').split('?')[0]||'welcome';
    if (document.querySelector(`#screen-${s}`)) switchScreen(s);
  });
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstallPrompt=e; renderInstallSteps(); });
  window.addEventListener('appinstalled', () => { deferredInstallPrompt=null; showToast('Installed'); renderInstallSteps(); });

  async function pi() {
    if (!deferredInstallPrompt) { renderInstallSteps(); switchScreen('install'); return; }
    deferredInstallPrompt.prompt(); await deferredInstallPrompt.userChoice; deferredInstallPrompt=null; renderInstallSteps();
  }
  els.installBtn?.addEventListener('click', pi);
  els.installFromWelcomeBtn?.addEventListener('click', pi);

  if (localChannel) localChannel.addEventListener('message', e => { if (e.data?.type==='broadcasts-updated' && !liveMode) { cachedBroadcasts=getLocalBroadcasts(); render(); } });

  const hp = new URLSearchParams(window.location.hash.split('?')[1]||'');
  if (hp.get('token')) { showNewPasswordForm(); switchScreen('admin'); }
}

// ── sw ────────────────────────────────────────────────────

async function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  try { await navigator.serviceWorker.register('./sw.js'); } catch {}
}

// ── boot ───────────────────────────────────────────────────

async function startApp() {
  bindEvents();
  liveMode = await initSupabase();
  if (liveMode) { await refreshLive(); subscribeRealtime(); setStatus(true); }
  else { setStatus(false); cachedBroadcasts = getLocalBroadcasts(); }
  render();
  const s = (window.location.hash.replace('#','').split('?')[0])||'welcome';
  if (document.querySelector(`#screen-${s}`)) switchScreen(s);
  await registerSW();
}
startApp();
