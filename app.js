'use strict';

const SUPABASE_URL = 'https://bmzzbtwhxhijueudznuk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtenpidHdoeGhpanVldWR6bnVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MDQzMzIsImV4cCI6MjA5NzM4MDMzMn0.K8r4XYMrSnCXQ4j_FJw7J4cbzuQ9O1RToDsmCUyLQSM';
const MAX_MEDIA_BYTES = 50 * 1024 * 1024;

const DEV = 'pfm_did';
let devId = localStorage.getItem(DEV);
if (!devId) {
  devId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  localStorage.setItem(DEV, devId);
}

let sb;
let live = false;
let channel;
let posts = [];
let reads = new Set();
let defInstall;
let showRead = false;
let imgCache = null;
let submitBusy = false;
let swRegistration;
let reloadPending = false;

const $ = selector => document.querySelector(selector);
const E = {
  list: $('#postsList'),
  cnt: $('#postCount'),
  rec: $('#recentList'),
  past: $('#pastList'),
  tabA: $('#tabActive'),
  tabR: $('#tabRead'),
  loginCard: $('#adminLoginCard'),
  center: $('#adminCenter'),
  lf: $('#adminLoginForm'),
  le: $('#adminEmail'),
  lp: $('#adminPassword'),
  sf: $('#signupForm'),
  se: $('#signupEmail'),
  sp: $('#signupPassword'),
  ss: $('#showSignupBtn'),
  bsl: $('#backToLoginFromSignup'),
  rf: $('#resetPasswordForm'),
  re: $('#resetEmail'),
  nf: $('#newPasswordForm'),
  np: $('#newPassword'),
  sr: $('#showResetBtn'),
  bl: $('#backToLoginBtn'),
  bf: $('#broadcastForm'),
  t: $('#title'),
  b: $('#body'),
  mu: $('#broadcastMediaUrl'),
  ifi: $('#broadcastImageFile'),
  ifs: $('#broadcastImageStatus'),
  vfi: $('#broadcastVideoFile'),
  vfs: $('#broadcastVideoStatus'),
  sbSeed: $('#seedBtn'),
  sbClear: $('#clearBtn'),
  lk: $('#lockAdminBtn'),
  ib: $('#installBtn'),
  iw: $('#installFromWelcomeBtn'),
  is: $('#installSteps'),
  bs: $('#backendStatus'),
  toast: $('#toast'),
  ub: $('#updateBanner'),
  ubt: $('#updateBannerText'),
  ubr: $('#refreshAppBtn'),
  ubd: $('#dismissUpdateBtn'),
  dot: $('#statusDot'),
  lbl: $('#statusLabel'),
  bSubmit: $('#broadcastForm button[type="submit"]'),
  demoOnly: [...document.querySelectorAll('[data-demo-only]')]
};

function toast(message) {
  E.toast.textContent = message;
  E.toast.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => E.toast.classList.remove('show'), 2500);
}

function showUpdateBanner(message) {
  if (E.ubt && message) E.ubt.textContent = message;
  E.ub?.classList.add('show');
}

function hideUpdateBanner() {
  E.ub?.classList.remove('show');
}

function esc(value) {
  const div = document.createElement('div');
  div.textContent = value || '';
  return div.innerHTML;
}

function escAttr(value) {
  return esc(value).replace(/"/g, '&quot;');
}

function dt(value) {
  return new Intl.DateTimeFormat('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function prio(value) {
  return { urgent: 'Urgent', important: 'Important', general: 'General' }[value] || 'General';
}

function norm(row) {
  return {
    id: row.id,
    title: row.title,
    body: row.body || row.message,
    priority: row.priority || 'general',
    created: row.created_at || row.created || new Date().toISOString(),
    expires: row.expires_at || null,
    is_active: row.isActive ?? row.is_active ?? true
  };
}

function isRead(item) {
  return reads.has(item.id);
}

function sorted(items, expired) {
  let out = [...items].filter(item => item.is_active !== false);
  if (!expired) out = out.filter(item => !item.expires || new Date(item.expires) > new Date());
  return out.sort((a, b) => {
    const aRead = isRead(a) ? 1 : 0;
    const bRead = isRead(b) ? 1 : 0;
    if (aRead !== bRead) return aRead - bRead;
    const aPriority = { urgent: 3, important: 2, general: 1 }[a.priority] || 0;
    const bPriority = { urgent: 3, important: 2, general: 1 }[b.priority] || 0;
    if (aPriority !== bPriority) return bPriority - aPriority;
    return new Date(b.created) - new Date(a.created);
  });
}

function on(connected) {
  if (E.dot) E.dot.style.background = connected ? '#15803d' : '#d71920';
  if (E.lbl) E.lbl.textContent = connected ? 'Connected' : 'Offline';
}

function getImgCache() {
  if (!imgCache) imgCache = JSON.parse(localStorage.getItem('pfm_imgs') || '{}');
  return imgCache;
}

function saveImgCache(url) {
  const cache = getImgCache();
  cache[url] = 1;
  localStorage.setItem('pfm_imgs', JSON.stringify(cache));
  imgCache = cache;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const power = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / (1024 ** power);
  return `${value >= 10 || power === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[power]}`;
}

function setFileStatus(element, message, tone) {
  if (!element) return;
  element.textContent = message || '';
  element.classList.remove('error', 'success');
  if (tone) element.classList.add(tone);
}

function setMediaStatus(message, tone) {
  setFileStatus(E.ifs, message, tone);
  setFileStatus(E.vfs, message, tone);
}

function setSingleMediaStatus(kind, message, tone) {
  const map = { image: E.ifs, video: E.vfs };
  setFileStatus(map[kind], message, tone);
}

function clearMediaStatuses() {
  setFileStatus(E.ifs, '');
  setFileStatus(E.vfs, '');
}

function updateSubmitState(busy, label) {
  submitBusy = busy;
  if (!E.bSubmit) return;
  E.bSubmit.disabled = busy;
  E.bSubmit.textContent = label || (busy ? 'Sending...' : 'Send Broadcast');
}

function sanitizeFileSegment(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'media';
}

function getSelectedImageFile() {
  return E.ifi?.files?.[0] || null;
}

function getSelectedVideoFile() {
  return E.vfi?.files?.[0] || null;
}

function getSelectedMediaFiles() {
  return [
    { kind: 'image', file: getSelectedImageFile() },
    { kind: 'video', file: getSelectedVideoFile() }
  ].filter(entry => entry.file);
}

function hasSelectedUploads() {
  return getSelectedMediaFiles().length > 0;
}

function updateMediaSelectionState() {
  const image = getSelectedImageFile();
  const video = getSelectedVideoFile();
  if (image) setSingleMediaStatus('image', `${image.name} selected (${formatBytes(image.size)})`);
  else setSingleMediaStatus('image', '');
  if (video) setSingleMediaStatus('video', `${video.name} selected (${formatBytes(video.size)})`);
  else setSingleMediaStatus('video', '');
}

function validateMediaFile(file, kind) {
  if (!file) return;
  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');
  if (kind === 'image' && !isImage) {
    throw new Error('Only image files are allowed in the image upload field');
  }
  if (kind === 'video' && !isVideo) {
    throw new Error('Only video files are allowed in the video upload field');
  }
  if (!(isImage || isVideo)) {
    throw new Error('Only image and video uploads are supported');
  }
  if (file.size > MAX_MEDIA_BYTES) {
    throw new Error('Files must be 50 MB or smaller');
  }
}

function getMessageWithMedia(bodyText, mediaUrls) {
  const parts = [bodyText.trim(), ...mediaUrls.filter(Boolean)];
  const message = parts.filter(Boolean).join('\n\n');
  if (message.length > 700) throw new Error('Message plus media links must stay under 700 characters');
  return message;
}

async function getAdminAccessToken() {
  const { data, error } = await sb.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error('Admin session expired. Please log in again.');
  return token;
}

async function uploadMediaFile(file, kind) {
  validateMediaFile(file, kind);
  const authToken = await getAdminAccessToken();

  const signResponse = await fetch('./api/media-upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`
    },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
      size: file.size
    })
  });

  const signPayload = await signResponse.json().catch(() => ({}));
  if (!signResponse.ok) throw new Error(signPayload.error || 'Could not prepare upload');

  const uploadResponse = await fetch(signPayload.uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type || 'application/octet-stream'
    },
    body: file
  });

  if (!uploadResponse.ok) {
    const uploadPayload = await uploadResponse.text().catch(() => '');
    throw new Error(uploadPayload || 'Could not upload file');
  }

  return signPayload.publicUrl;
}

function shortenUrl(url) {
  try {
    const parsed = new URL(url);
    const compact = `${parsed.hostname.replace(/^www\./i, '')}${parsed.pathname}${parsed.search}`;
    return compact.length > 62 ? `${compact.slice(0, 59)}...` : compact;
  } catch {
    return url.length > 62 ? `${url.slice(0, 59)}...` : url;
  }
}

function splitTrailing(raw) {
  let url = raw;
  let trailing = '';

  while (url) {
    const last = url.slice(-1);
    if (/[.,!?]/.test(last)) {
      trailing = last + trailing;
      url = url.slice(0, -1);
      continue;
    }
    if (last === ')' || last === ']' || last === '}') {
      const open = { ')': '(', ']': '[', '}': '{' }[last];
      const opens = (url.match(new RegExp(`\\${open}`, 'g')) || []).length;
      const closes = (url.match(new RegExp(`\\${last}`, 'g')) || []).length;
      if (closes > opens) {
        trailing = last + trailing;
        url = url.slice(0, -1);
        continue;
      }
    }
    break;
  }

  return { url, trailing };
}

function getYouTubeId(parsed) {
  const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
  if (host === 'youtu.be') {
    return parsed.pathname.split('/').filter(Boolean)[0] || '';
  }
  if (!host.endsWith('youtube.com')) return '';
  if (parsed.searchParams.get('v')) return parsed.searchParams.get('v') || '';
  const parts = parsed.pathname.split('/').filter(Boolean);
  if (parts[0] === 'embed' || parts[0] === 'shorts' || parts[0] === 'live') return parts[1] || '';
  return '';
}

function getVimeoId(parsed) {
  const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
  if (!host.endsWith('vimeo.com')) return '';
  return parsed.pathname.split('/').filter(Boolean).find(part => /^\d+$/.test(part)) || '';
}

function classifyUrl(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const path = parsed.pathname.toLowerCase();
    const ext = (path.match(/\.([a-z0-9]+)$/i) || [])[1] || '';

    if (
      ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'].includes(ext) ||
      host === 'images.unsplash.com' ||
      host === 'picsum.photos'
    ) {
      return { type: 'image', url, badge: host === 'images.unsplash.com' ? 'Unsplash' : 'Image' };
    }

    const ytId = getYouTubeId(parsed);
    if (ytId) return { type: 'youtube', url, id: ytId, badge: 'YouTube' };

    const vimeoId = getVimeoId(parsed);
    if (vimeoId) return { type: 'vimeo', url, id: vimeoId, badge: 'Vimeo' };

    if (['mp4', 'webm', 'mov', 'm4v', 'ogg'].includes(ext)) {
      return { type: 'video', url, badge: 'Video file' };
    }
  } catch {
    return { type: 'link', url, badge: 'Link' };
  }

  return { type: 'link', url, badge: 'Link' };
}

function renderLink(url, text) {
  const label = text || shortenUrl(url);
  return `<a class="inline-link" href="${escAttr(url)}" target="_blank" rel="noopener">${esc(label)}</a>`;
}

function renderImage(url, loaded) {
  if (loaded) {
    return `
      <div class="media-block">
        <div class="media-preview">
          <img src="${escAttr(url)}" loading="lazy" alt="Broadcast image preview" onerror="this.closest('.media-block').remove()" />
        </div>
        ${renderLink(url)}
      </div>
    `;
  }

  return `
    <div class="media-block">
      <button class="media-launch img-load" type="button" data-img="${escAttr(url)}">
        <span class="media-chip">Image</span>
        <strong>Tap to view image</strong>
        <span>Loads only when you choose it.</span>
      </button>
      ${renderLink(url)}
    </div>
  `;
}

function renderVideo(meta) {
  const action = meta.type === 'video' ? 'Tap to play video' : 'Tap to open player';
  return `
    <div class="media-block">
      <button class="media-launch vid-card" type="button" data-kind="${escAttr(meta.type)}" data-src="${escAttr(meta.url)}" data-id="${escAttr(meta.id || '')}">
        <span class="media-chip">${esc(meta.badge)}</span>
        <strong>${action}</strong>
        <span>Stays unloaded until you open it in this post.</span>
      </button>
      ${renderLink(meta.url)}
    </div>
  `;
}

function renderBody(text) {
  const source = String(text || '');
  const loaded = getImgCache();
  const urlRegex = /https?:\/\/\S+/gi;
  let out = '';
  let lastIndex = 0;
  let match;

  while ((match = urlRegex.exec(source))) {
    out += esc(source.slice(lastIndex, match.index));
    const token = splitTrailing(match[0]);
    const meta = classifyUrl(token.url);

    if (meta.type === 'image') out += renderImage(meta.url, loaded[meta.url]);
    else if (meta.type === 'video' || meta.type === 'youtube' || meta.type === 'vimeo') out += renderVideo(meta);
    else out += renderLink(meta.url);

    out += esc(token.trailing);
    lastIndex = match.index + match[0].length;
  }

  out += esc(source.slice(lastIndex));
  return out;
}

async function refresh() {
  try {
    const [postQuery, readQuery] = await Promise.all([
      sb.from('broadcasts')
        .select('id,title,message,priority,created_at,expires_at,is_active')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(200),
      sb.from('broadcast_reads').select('broadcast_id').eq('device_id', devId)
    ]);

    if (!postQuery.error) posts = (postQuery.data || []).map(norm);
    if (!readQuery.error) reads = new Set((readQuery.data || []).map(row => row.broadcast_id));
    render();
  } catch (error) {
    console.error(error);
  }
}

function sub() {
  if (!sb || channel) return;
  channel = sb.channel('p')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'broadcasts' }, refresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'broadcast_reads' }, refresh)
    .subscribe();
}

function admin() {
  return live && sessionStorage.getItem('pfm_ad') === '1';
}

async function login() {
  const { data, error } = await sb.auth.signInWithPassword({
    email: E.le.value.trim(),
    password: E.lp.value
  });
  if (error) throw error;

  const { data: profile } = await sb.from('admin_profiles')
    .select('is_admin')
    .eq('user_id', data.user.id)
    .eq('is_admin', true)
    .maybeSingle();

  if (!profile) throw new Error('Not an approved admin');
  sessionStorage.setItem('pfm_ad', '1');
}

async function create() {
  const hours = document.querySelector('#expiry')?.value;
  const mediaUrl = E.mu?.value.trim();
  const mediaFiles = getSelectedMediaFiles();
  const expires = hours ? new Date(Date.now() + Number(hours) * 3600000).toISOString() : null;
  const mediaUrls = [];

  if (mediaUrl) mediaUrls.push(mediaUrl);
  for (const entry of mediaFiles) {
    setSingleMediaStatus(entry.kind, `Uploading ${entry.file.name}...`);
    mediaUrls.push(await uploadMediaFile(entry.file, entry.kind));
    setSingleMediaStatus(entry.kind, `${entry.file.name} uploaded successfully.`, 'success');
  }

  const message = getMessageWithMedia(E.b.value, mediaUrls);

  const { error } = await sb.from('broadcasts').insert({
    title: E.t.value.trim(),
    message,
    priority: document.querySelector('input[name="priority"]:checked')?.value || 'general',
    expires_at: expires,
    is_active: true
  });

  if (error) throw error;
  await refresh();
  toast('Broadcast sent');
  switchScreen('posts');
}

async function del(id) {
  await sb.from('broadcasts').update({ is_active: false }).eq('id', id);
  await refresh();
  toast('Deleted');
}

function renderPosts() {
  const active = sorted(posts).filter(item => !isRead(item));
  const readItems = sorted(posts).filter(item => isRead(item));
  const items = showRead ? readItems : active;

  E.cnt.textContent = `${items.length} post${items.length !== 1 ? 's' : ''}`;
  if (!showRead) {
    const unread = active.length;
    if (unread) E.cnt.textContent += ` - ${unread} unread`;
  }

  E.list.innerHTML = items.length ? '' : `<div class="empty">${showRead ? 'No read posts yet.' : 'No posts yet.'}</div>`;
  items.forEach(item => {
    const card = document.createElement('article');
    const read = isRead(item);
    card.className = `post-card ${read ? 'read ' : 'unread '}${esc(item.priority)}`;
    card.innerHTML = `
      <div class="post-top">
        <h3>${esc(item.title)}</h3>
        <span class="tag ${read ? 'read' : esc(item.priority)}">${read ? 'Read' : prio(item.priority)}</span>
      </div>
      <div class="post-body">${renderBody(item.body)}</div>
      <div class="post-meta">
        <span>${dt(item.created)}</span>
        <button class="${read ? 'btn-secondary' : ''}" type="button" data-read="${esc(item.id)}">${read ? 'Read again' : 'I have read this'}</button>
      </div>
    `;
    E.list.appendChild(card);
  });
}

function renderRecent() {
  if (!E.rec) return;
  const items = sorted(posts).slice(0, 10);
  E.rec.innerHTML = items.length ? '' : '<div class="empty">No active broadcasts.</div>';
  items.forEach(item => {
    const div = document.createElement('div');
    div.className = 'recent-item';
    div.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
        <div>
          <strong>${esc(item.title)}</strong><br>
          <span>${prio(item.priority)} - ${dt(item.created)}${item.expires ? ` - Expires: ${dt(item.expires)}` : ''}</span>
        </div>
        <button class="btn-link" data-delete="${esc(item.id)}" style="color:#d71920;font-size:12px">Delete</button>
      </div>
    `;
    E.rec.appendChild(div);
  });
}

function renderPast() {
  if (!E.past) return;
  const past = posts.filter(item => item.is_active !== false && item.expires && new Date(item.expires) <= new Date());
  E.past.innerHTML = past.length ? '' : '<div class="empty">No expired posts.</div>';
  past.forEach(item => {
    const div = document.createElement('div');
    div.className = 'recent-item';
    div.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
        <div>
          <strong>${esc(item.title)}</strong><br>
          <span>Expired: ${dt(item.expires)}</span>
        </div>
        <button class="btn-link" data-delete="${esc(item.id)}" style="color:#d71920;font-size:12px">Delete</button>
      </div>
    `;
    E.past.appendChild(div);
  });
}

function renderInstallSteps() {
  if (!E.is || !E.ib) return;

  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const ua = navigator.userAgent;
  const isIOS = /iphone|ipad|ipod/i.test(ua);
  const isAndroid = /android/i.test(ua);

  if (standalone) {
    E.is.innerHTML = '<div><strong>Installed.</strong> PFM Broadcasts is already running from the home screen.</div>';
    E.ib.disabled = true;
    E.ib.textContent = 'Already installed';
    return;
  }

  if (defInstall) {
    E.is.innerHTML = '<div><strong>Ready.</strong> Tap Install App and confirm the browser prompt.</div>';
    E.ib.disabled = false;
    E.ib.textContent = 'Install PFM Broadcasts';
    return;
  }

  if (isAndroid) {
    E.is.innerHTML = `
      <div><strong>Android Chrome:</strong> open the browser menu and choose Install app or Add to Home screen.</div>
      <div>If the prompt does not show immediately, open the site over HTTPS and revisit it once.</div>
    `;
    E.ib.disabled = true;
    E.ib.textContent = 'Use Chrome menu';
    return;
  }

  if (isIOS) {
    E.is.innerHTML = '<div><strong>iPhone:</strong> open in Safari, tap Share, then choose Add to Home Screen.</div>';
    E.ib.disabled = true;
    E.ib.textContent = 'Use Safari Share';
    return;
  }

  E.is.innerHTML = '<div><strong>Desktop:</strong> use the install icon in Chrome or Edge if it appears in the address bar.</div>';
  E.ib.disabled = true;
  E.ib.textContent = 'Install option not shown yet';
}

function renderAdmin() {
  if (E.loginCard) E.loginCard.classList.toggle('hidden', admin());
  if (E.center) E.center.classList.toggle('hidden', !admin());
  if (E.bs) {
    E.bs.innerHTML = live
      ? '<strong>Supabase connected</strong><span>Realtime updates are available across devices.</span>'
      : '<strong>Not connected</strong><span>Supabase did not initialize, so the app is currently offline.</span>';
  }
  E.demoOnly.forEach(node => node.classList.toggle('hidden', live));
}

function watchServiceWorker(registration) {
  if (!registration) return;
  swRegistration = registration;

  if (registration.waiting) {
    showUpdateBanner('A newer version of PFM Broadcasts is ready. Refresh to load the latest admin tools and fixes.');
  }

  registration.addEventListener('updatefound', () => {
    const worker = registration.installing;
    if (!worker) return;
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) {
        showUpdateBanner('A newer version of PFM Broadcasts has been downloaded. Refresh to use the latest version.');
      }
    });
  });

  setTimeout(() => registration.update().catch(() => {}), 3000);
}

function render() {
  renderPosts();
  renderRecent();
  renderPast();
  renderInstallSteps();
  renderAdmin();
}

function show(screen) {
  [E.lf, E.sf, E.rf, E.nf].forEach(form => form?.classList.add('hidden'));
  const map = { login: E.lf, signup: E.sf, reset: E.rf, new: E.nf };
  map[screen]?.classList.remove('hidden');
}

function switchScreen(screen) {
  document.querySelectorAll('.screen').forEach(node => node.classList.toggle('active', node.id === `screen-${screen}`));
  document.querySelectorAll('.nav-btn').forEach(node => node.classList.toggle('active', node.dataset.screen === screen));
  if (screen === 'admin') renderAdmin();
  history.replaceState(null, '', `#${screen}`);
  scrollTo(0, 0);
}

async function init() {
  render();

  let tries = 0;
  while (!window.supabase && tries < 50) {
    await new Promise(resolve => setTimeout(resolve, 100));
    tries += 1;
  }

  if (!window.supabase) {
    on(false);
    render();
    return;
  }

  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  try {
    const { error } = await sb.from('broadcasts').select('id').limit(1);
    if (error) throw error;
  } catch (error) {
    console.error('Probe failed:', error.message);
    on(false);
    render();
    return;
  }

  live = true;
  on(true);

  sb.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      show('new');
      switchScreen('admin');
    }

    if (session?.user) {
      sb.from('admin_profiles')
        .select('is_admin')
        .eq('user_id', session.user.id)
        .eq('is_admin', true)
        .maybeSingle()
        .then(result => {
          sessionStorage.setItem('pfm_ad', result.data ? '1' : '');
          renderAdmin();
        })
        .catch(() => {
          sessionStorage.removeItem('pfm_ad');
          renderAdmin();
        });
    } else {
      sessionStorage.removeItem('pfm_ad');
      renderAdmin();
    }
  });

  const { data: sessionData } = await sb.auth.getSession();
  if (sessionData?.session?.user) {
    sb.from('admin_profiles')
      .select('is_admin')
      .eq('user_id', sessionData.session.user.id)
      .eq('is_admin', true)
      .maybeSingle()
      .then(result => {
        sessionStorage.setItem('pfm_ad', result.data ? '1' : '');
        renderAdmin();
      });
  }

  await refresh();
  sub();

  const standalone = window.matchMedia('(display-mode:standalone)').matches || window.navigator.standalone === true;
  if (standalone && !location.hash) {
    switchScreen('posts');
    return;
  }

  const screen = (location.hash || '#welcome').replace('#', '');
  if (document.querySelector(`#screen-${screen}`)) switchScreen(screen);
}

init();

document.addEventListener('click', async event => {
  const screenButton = event.target.closest('[data-screen]');
  if (screenButton) {
    switchScreen(screenButton.dataset.screen);
    return;
  }

  const readButton = event.target.closest('[data-read]');
  if (readButton) {
    if (!live) return;
    await sb.from('broadcast_reads').upsert(
      { broadcast_id: readButton.dataset.read, device_id: devId },
      { onConflict: 'broadcast_id,device_id' }
    );
    reads.add(readButton.dataset.read);
    render();
    toast('Marked as read');
    return;
  }

  const deleteButton = event.target.closest('[data-delete]');
  if (deleteButton) {
    if (confirm('Delete this broadcast?')) await del(deleteButton.dataset.delete);
    return;
  }

  const imageButton = event.target.closest('.img-load');
  if (imageButton) {
    saveImgCache(imageButton.dataset.img);
    const preview = document.createElement('div');
    preview.className = 'media-preview';
    preview.innerHTML = `<img src="${escAttr(imageButton.dataset.img)}" loading="lazy" alt="Broadcast image preview">`;
    preview.querySelector('img').onerror = () => preview.closest('.media-block')?.remove();
    try {
      imageButton.replaceWith(preview);
    } catch {
      render();
    }
    return;
  }

  const videoButton = event.target.closest('.vid-card');
  if (videoButton) {
    const type = videoButton.dataset.kind;
    const src = videoButton.dataset.src;
    const id = videoButton.dataset.id;
    const preview = document.createElement('div');
    preview.className = 'media-preview';
    let player;

    if (type === 'youtube') {
      player = document.createElement('iframe');
      player.src = `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`;
      player.allow = 'autoplay; fullscreen; picture-in-picture';
      player.style.aspectRatio = '16 / 9';
    } else if (type === 'vimeo') {
      player = document.createElement('iframe');
      player.src = `https://player.vimeo.com/video/${id}?autoplay=1`;
      player.allow = 'autoplay; fullscreen; picture-in-picture';
      player.style.aspectRatio = '16 / 9';
    } else {
      player = document.createElement('video');
      player.src = src;
      player.controls = true;
      player.preload = 'metadata';
      player.playsInline = true;
      player.autoplay = true;
      player.style.maxHeight = '360px';
    }

    player.onerror = () => {
      preview.remove();
      toast('This video could not be loaded');
    };
    preview.appendChild(player);

    try {
      videoButton.replaceWith(preview);
      if (player.tagName === 'VIDEO') {
        const play = player.play?.();
        if (play?.catch) play.catch(() => {});
      }
    } catch {
      render();
    }
  }
});

E.lf?.addEventListener('submit', async event => {
  event.preventDefault();
  try {
    await login();
    toast('Unlocked');
    renderAdmin();
  } catch (error) {
    toast(error.message || 'Login failed');
  }
});

E.sf?.addEventListener('submit', async event => {
  event.preventDefault();
  if (!live) {
    toast('Supabase connection required');
    return;
  }

  try {
    const { data, error } = await sb.auth.signUp({
      email: E.se.value.trim(),
      password: E.sp.value
    });
    if (error) throw error;
    if (data.session) await sb.auth.signOut();
    E.sf.reset();
    show('login');
    toast('Account created. Ask an admin to approve access if needed.');
  } catch (error) {
    toast(error.message || 'Account creation failed');
  }
});

E.rf?.addEventListener('submit', async event => {
  event.preventDefault();
  if (!live) {
    toast('Supabase connection required');
    return;
  }
  await sb.auth.resetPasswordForEmail(E.re.value.trim());
  toast('Email sent');
  show('login');
});

E.nf?.addEventListener('submit', async event => {
  event.preventDefault();
  if (!live) {
    toast('Supabase connection required');
    return;
  }
  await sb.auth.updateUser({ password: E.np.value });
  toast('Updated');
  show('login');
});

E.bf?.addEventListener('submit', async event => {
  event.preventDefault();
  try {
    updateSubmitState(true, hasSelectedUploads() ? 'Uploading media...' : 'Sending Broadcast');
    await create();
    E.bf.reset();
    E.bf.querySelector('input[name="priority"][value="important"]').checked = true;
    clearMediaStatuses();
    updateMediaSelectionState();
  } catch (error) {
    toast(error.message || 'Could not send broadcast');
    if (error.message) setMediaStatus(error.message, 'error');
  } finally {
    updateSubmitState(false);
  }
});

E.ifi?.addEventListener('change', () => {
  try {
    const file = getSelectedImageFile();
    if (file) validateMediaFile(file, 'image');
    updateMediaSelectionState();
  } catch (error) {
    if (E.ifi) E.ifi.value = '';
    setSingleMediaStatus('image', error.message || 'That image could not be used.', 'error');
  }
});
E.vfi?.addEventListener('change', () => {
  try {
    const file = getSelectedVideoFile();
    if (file) validateMediaFile(file, 'video');
    updateMediaSelectionState();
  } catch (error) {
    if (E.vfi) E.vfi.value = '';
    setSingleMediaStatus('video', error.message || 'That video could not be used.', 'error');
  }
});
E.ubr?.addEventListener('click', () => {
  hideUpdateBanner();
  if (swRegistration?.waiting) {
    swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }
  location.reload();
});
E.ubd?.addEventListener('click', () => hideUpdateBanner());

E.sr?.addEventListener('click', () => show('reset'));
E.ss?.addEventListener('click', () => show('signup'));
E.bl?.addEventListener('click', () => show('login'));
E.bsl?.addEventListener('click', () => show('login'));
E.lk?.addEventListener('click', async () => {
  if (live) await sb.auth.signOut();
  sessionStorage.removeItem('pfm_ad');
  renderAdmin();
  toast('Locked');
});
E.sbSeed?.addEventListener('click', () => toast('Demo tools are hidden while the live backend is connected.'));
E.sbClear?.addEventListener('click', () => toast('Demo tools are hidden while the live backend is connected.'));
E.tabA?.addEventListener('click', () => {
  showRead = false;
  E.tabA.classList.add('active');
  E.tabR.classList.remove('active');
  renderPosts();
});
E.tabR?.addEventListener('click', () => {
  showRead = true;
  E.tabR.classList.add('active');
  E.tabA.classList.remove('active');
  renderPosts();
});

window.addEventListener('hashchange', () => {
  const screen = location.hash.replace('#', '');
  if (document.querySelector(`#screen-${screen}`)) switchScreen(screen);
});
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  defInstall = event;
  renderInstallSteps();
});
window.addEventListener('appinstalled', () => {
  defInstall = null;
  renderInstallSteps();
});
window.addEventListener('beforeunload', () => {
  if (channel) {
    sb.removeChannel(channel);
    channel = null;
  }
});
E.ib?.addEventListener('click', async () => {
  if (!defInstall) {
    switchScreen('install');
    renderInstallSteps();
    return;
  }
  defInstall.prompt();
  await defInstall.userChoice;
  defInstall = null;
  renderInstallSteps();
});
E.iw?.addEventListener('click', async () => {
  if (!defInstall) {
    switchScreen('install');
    renderInstallSteps();
    return;
  }
  defInstall.prompt();
  await defInstall.userChoice;
  defInstall = null;
  renderInstallSteps();
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadPending) return;
    reloadPending = true;
    showUpdateBanner('PFM Broadcasts has been updated. Refresh now to load the newest version.');
  });

  navigator.serviceWorker.register('./sw.js').then(watchServiceWorker).catch(() => {});
}
