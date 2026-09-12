// Service worker de coversign: permite instalar la app y navegar el
// catálogo ya visitado sin conexión. Aportar portadas nuevas y buscar
// metadata por ISBN siguen necesitando conexión (van directo a la red).
const SHELL_CACHE = 'coversign-shell-v1';
const RUNTIME_CACHE = 'coversign-runtime-v1';

const SHELL_ASSETS = [
  '/',
  '/styles.css',
  '/app.js',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL_CACHE && k !== RUNTIME_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw err;
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return; // los POST (aportar, subir imagen) van directo a la red

  const url = new URL(request.url);

  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (url.origin === self.location.origin && SHELL_ASSETS.includes(url.pathname)) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
    return;
  }

  if (url.pathname.startsWith('/covers/') || request.destination === 'image') {
    event.respondWith(cacheFirst(request, RUNTIME_CACHE));
    return;
  }
});
