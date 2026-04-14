const CACHE_NAME = 'friendbank-v3';
const PRECACHE_URLS = [
  '/',
  '/friend_bank_v4.html',
  '/logo.png'
];

// Install — cache shell assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// Activate — clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — network first for API, cache first for assets
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Always go to network for API calls
  if (url.pathname.startsWith('/api/')) {
    return event.respondWith(fetch(event.request));
  }

  // For HTML navigation requests, prefer fresh network content.
  // This avoids serving stale app shells after deployments.
  if (event.request.mode === 'navigate') {
    return event.respondWith(
      fetch(event.request).catch(() => caches.match('/friend_bank_v4.html'))
    );
  }

  // For everything else: network first, fall back to cache
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache successful GET responses
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
