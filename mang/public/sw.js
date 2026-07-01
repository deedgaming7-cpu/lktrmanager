const CACHE = 'store-manager-v8';
const STATIC = ['/', '/css/main.css', '/js/app.js', '/js/api.js', '/js/utils.js',
  '/js/pages/dashboard.js', '/js/pages/orders.js', '/js/pages/products.js',
  '/js/pages/customers.js', '/js/pages/cash.js', '/js/pages/expenses.js',
  '/js/pages/reports.js', '/js/pages/settings.js', '/manifest.json', '/icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.url.includes('/api/')) {
    e.respondWith(fetch(e.request).catch(() => new Response('{"error":"offline"}', { headers: { 'Content-Type': 'application/json' } })));
    return;
  }
  e.respondWith(caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
    const clone = res.clone();
    caches.open(CACHE).then(c => c.put(e.request, clone));
    return res;
  })));
});
