/**
 * POS SaaS — Service Worker
 * Manual implementation tanpa library untuk kompatibilitas Next.js 16 + Turbopack
 */

const CACHE_VERSION = "v1";
const STATIC_CACHE = `pos-static-${CACHE_VERSION}`;
const PAGES_CACHE = `pos-pages-${CACHE_VERSION}`;
const IMAGES_CACHE = `pos-images-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline.html";

// Assets yang di-precache saat install
const PRECACHE_ASSETS = [
  OFFLINE_URL,
  "/manifest.json",
  "/icons/icon-192x192.svg",
  "/icons/icon-512x512.svg",
];

// ── Install: precache assets penting ──────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn("[SW] Precache failed:", err);
      });
    })
  );
  self.skipWaiting();
});

// ── Message: trigger cache halaman POS dari client ─────────────
self.addEventListener("message", (event) => {
  if (event.data?.type === "CACHE_POS_PAGE") {
    caches.open(PAGES_CACHE).then((cache) => {
      cache.add("/dashboard/pos").catch(() => {});
    });
  }
});
// ── Activate: hapus cache lama ─────────────────────────────────
self.addEventListener("activate", (event) => {
  const validCaches = [STATIC_CACHE, PAGES_CACHE, IMAGES_CACHE];
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => !validCaches.includes(key))
          .map((key) => {
            console.log("[SW] Deleting old cache:", key);
            return caches.delete(key);
          })
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: strategi per tipe request ──────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Abaikan non-GET dan request ke API (kecuali sync-data)
  if (request.method !== "GET") return;
  if (url.pathname.startsWith("/api/") && !url.pathname.includes("/api/offline/sync-data")) return;
  // Abaikan chrome-extension dan non-http
  if (!url.protocol.startsWith("http")) return;

  // ── Navigasi halaman: NetworkFirst dengan fallback offline ──
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache halaman yang berhasil diload
          if (response.ok) {
            const clone = response.clone();
            caches.open(PAGES_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          // Offline: coba dari cache halaman
          const cached = await caches.match(request);
          if (cached) return cached;

          // Coba /dashboard/pos dari cache
          const posPage = await caches.match("/dashboard/pos");
          if (posPage && url.pathname.startsWith("/dashboard")) return posPage;

          // Fallback ke offline.html
          const offlinePage = await caches.match(OFFLINE_URL);
          if (offlinePage) return offlinePage;

          // Last resort inline
          return new Response(
            `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline — POS SaaS</title><style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f9fafb}div{text-align:center;padding:32px}h1{color:#111827}p{color:#6b7280}a{color:#2563eb}</style></head><body><div><h1>Tidak Ada Koneksi</h1><p>Sambungkan internet lalu <a href="/dashboard/pos">kembali ke kasir</a></p></div><script>window.addEventListener('online',()=>{window.location.href='/dashboard/pos'})</script></body></html>`,
            { headers: { "Content-Type": "text/html; charset=utf-8" } }
          );
        })
    );
    return;
  }

  // ── Gambar: CacheFirst ──────────────────────────────────────
  if (
    request.destination === "image" ||
    url.hostname.includes("blob.vercel-storage.com")
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(IMAGES_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        }).catch(() => new Response("", { status: 404 }));
      })
    );
    return;
  }

  // ── Static assets Next.js: CacheFirst ──────────────────────
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // ── API offline sync-data: StaleWhileRevalidate ─────────────
  if (url.pathname.includes("/api/offline/sync-data")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        });
        return cached || fetchPromise;
      })
    );
    return;
  }
});
