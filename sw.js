// Service worker: cache app shell để lượt truy cập sau nhanh hơn.
// Khi deploy bản mới: TĂNG CACHE_VERSION để xoá cache cũ trên thiết bị người dùng.
const CACHE_VERSION = "v4";
const SHELL = ["./", "./index.html", "./js/app.js"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  // data.json: ưu tiên dữ liệu mới nhất, cache chỉ dùng khi offline
  if (url.pathname.endsWith("data.json")) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // App shell: dùng cache ngay, cập nhật bản mới nền (stale-while-revalidate)
  event.respondWith(
    caches.match(request).then((cached) => {
      const fresh = fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fresh;
    })
  );
});
