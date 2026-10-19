const CACHE_NAME = "wasspadaapp-v2";
const OFFLINE_URL = "/";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        cache
          .addAll([
            OFFLINE_URL,
            "/manifest.json",
            "/icon-192x192.jpeg",
            "/icon-512x512.jpeg",
          ])
          .catch(() => {})
      )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Hanya tangani request same-origin. Request lintas origin (Supabase,
  // Google, dst.) dibiarkan langsung ke network.
  if (url.origin !== self.location.origin) return;

  // API & data dinamis jangan pernah di-cache.
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() =>
        caches.match(request).then((cached) => {
          if (cached) return cached;
          // Fallback halaman offline hanya untuk navigasi halaman —
          // jangan pernah kembalikan HTML untuk gambar/script/api.
          if (request.mode === "navigate") return caches.match(OFFLINE_URL);
          return Response.error();
        })
      )
  );
});
