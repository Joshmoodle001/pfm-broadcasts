const CACHE = 'pfm-v8';
const SHELL = ['./','./index.html','./app.js','./manifest.webmanifest','./assets/pfm-logo-full.png','./assets/pfm-logo-lockup.png','./assets/pfm-mark.png','./assets/pfm-mark-wide.png','./icons/icon-72.png','./icons/icon-96.png','./icons/icon-128.png','./icons/icon-144.png','./icons/icon-152.png','./icons/icon-180.png','./icons/icon-192.png','./icons/icon-384.png','./icons/icon-512.png','./icons/apple-touch-icon-180.png','./icons/maskable-icon-192.png','./icons/maskable-icon-512.png'];
const NETWORK_FIRST = new Set(['/', '/index.html', '/app.js', '/sw.js', '/manifest.webmanifest']);

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => {
    return Promise.allSettled(SHELL.map(url => c.add(url).catch(() => {})));
  }));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x)))));
  self.clients.claim();
});

self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  if (u.origin === self.location.origin && !u.pathname.startsWith('/rest/') && !u.pathname.startsWith('/auth/')) {
    if (e.request.mode === 'navigate' || NETWORK_FIRST.has(u.pathname)) {
      e.respondWith(
        fetch(e.request)
          .then(r => {
            if (r.ok) {
              const clone = r.clone();
              caches.open(CACHE).then(ca => ca.put(e.request, clone));
            }
            return r;
          })
          .catch(() => caches.match(e.request).then(c => c || caches.match('./index.html')))
      );
      return;
    }

    e.respondWith(caches.match(e.request).then(c => c || fetch(e.request).then(r => { if(r.ok){const clone=r.clone();caches.open(CACHE).then(ca => ca.put(e.request,clone))} return r; })));
  }
});
