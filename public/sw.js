// Al-Mustaqbal University Attendance System - Production PWA Service Worker
const CACHE_NAME = 'uomus-attendance-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
  '/apple-touch-icon.png',
  '/favicon.png',
];

// Sensitive endpoints that MUST NEVER be cached
const SENSITIVE_ENDPOINTS = [
  '/api/auth',
  '/api/users',
  '/api/backup',
  '/api/audit',
  '/api/devices',
];

// Install Event: Precaches essential static shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Failed to cache some static assets during install:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate Event: Cleans up old cache versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Deleting deprecated cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Smart routing & caching
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // 1. Only handle GET requests. Mutating requests (POST, PUT, DELETE) always go to network.
  if (request.method !== 'GET') {
    return;
  }

  // 2. Do not cache browser extensions or external non-http schemes
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // 3. STRICT SECURITY: Do not cache sensitive endpoints (passwords, auth tokens, device secrets)
  const isSensitive = SENSITIVE_ENDPOINTS.some((prefix) => url.pathname.startsWith(prefix));
  if (isSensitive) {
    return; // Pass directly to network without caching
  }

  // 4. API Requests (Read-only data like schedules, departments, rooms, subjects):
  // Strategy: Network-first, fallback to cache if offline
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, clone);
            });
          }
          return response;
        })
        .catch(async () => {
          // If network failed (offline), check cache for read-only data
          const cached = await caches.match(request);
          if (cached) {
            return cached;
          }
          return new Response(
            JSON.stringify({
              error: 'أنت في وضع عدم الاتصال (Offline). تعذر جلب البيانات الحديثة.',
              offline: true,
            }),
            {
              status: 503,
              headers: { 'Content-Type': 'application/json; charset=utf-8' },
            }
          );
        })
    );
    return;
  }

  // 5. HTML Navigation Requests (App Shell):
  // Strategy: Network first, fallback to cached index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match('/index.html');
        return cached || (await caches.match('/'));
      })
    );
    return;
  }

  // 6. Static Assets (Scripts, Styles, Images, Fonts, Icons):
  // Strategy: Stale-While-Revalidate or Cache-First with network fallback
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clone);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Return cached or ignore
        return cachedResponse;
      });

      return cachedResponse || fetchPromise;
    })
  );
});
