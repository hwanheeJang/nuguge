const CACHE = 'nuguge-v9';
const STATIC_ASSETS = ['./manifest.json', './icon.svg', './icon-maskable.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(Promise.all([
    self.clients.claim(),
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  ]));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // 비-HTTP 스킴(chrome-extension, file 등) 무시 — 캐시 시도하지 않음
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Gemini API 우회 (캐시 안 함)
  if (url.hostname.includes('generativelanguage.googleapis.com')) return;

  // HTML / 메인 페이지: 네트워크 우선
  const isHTML = e.request.mode === 'navigate' ||
                 (e.request.headers.get('accept')||'').includes('text/html') ||
                 url.pathname.endsWith('.html') ||
                 url.pathname.endsWith('/');
  if (isHTML) {
    e.respondWith(
      fetch(e.request).then(resp => {
        if (resp && resp.ok) {
          const copy = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy)).catch(()=>{});
        }
        return resp;
      }).catch(() => caches.match(e.request).then(c => c || caches.match('./index.html')))
    );
    return;
  }

  // 정적 리소스: 캐시 우선
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(resp => {
      if (resp && resp.ok) {
        const copy = resp.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(()=>{});
      }
      return resp;
    }))
  );
});
