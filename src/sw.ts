import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist, NetworkFirst, CacheFirst, StaleWhileRevalidate, ExpirationPlugin } from "serwist";

declare global {
  interface ServiceWorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const OFFLINE_URL = "/offline.html";

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false, // matikan agar fetch event kita yang handle

  runtimeCaching: [
    // ── Halaman POS — NetworkFirst ──
    {
      matcher: /^https?:\/\/.*\/dashboard\/pos/,
      handler: new NetworkFirst({
        cacheName: "pos-pages",
        plugins: [new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 24 * 60 * 60 })],
        networkTimeoutSeconds: 5,
      }),
    },
    // ── Semua halaman dashboard ──
    {
      matcher: /^https?:\/\/.*\/dashboard/,
      handler: new NetworkFirst({
        cacheName: "dashboard-pages",
        plugins: [new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 24 * 60 * 60 })],
        networkTimeoutSeconds: 5,
      }),
    },
    // ── Login page ──
    {
      matcher: /^https?:\/\/.*\/login/,
      handler: new NetworkFirst({
        cacheName: "auth-pages",
        plugins: [new ExpirationPlugin({ maxEntries: 5, maxAgeSeconds: 24 * 60 * 60 })],
        networkTimeoutSeconds: 5,
      }),
    },
    // ── API sync data offline ──
    {
      matcher: /\/api\/offline\/sync-data/,
      handler: new StaleWhileRevalidate({
        cacheName: "offline-sync-data",
        plugins: [new ExpirationPlugin({ maxEntries: 5, maxAgeSeconds: 24 * 60 * 60 })],
      }),
    },
    // ── Gambar produk ──
    {
      matcher: /\.(?:png|jpg|jpeg|gif|webp|ico)$/,
      handler: new CacheFirst({
        cacheName: "images",
        plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 })],
      }),
    },
    // ── Vercel Blob ──
    {
      matcher: /^https:\/\/.*\.public\.blob\.vercel-storage\.com\/.*/,
      handler: new CacheFirst({
        cacheName: "blob-images",
        plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 })],
      }),
    },
    // ── Google Fonts ──
    {
      matcher: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/,
      handler: new CacheFirst({
        cacheName: "google-fonts",
        plugins: [new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 })],
      }),
    },
    // ── Next.js static assets ──
    {
      matcher: /\/_next\/static\/.*/,
      handler: new CacheFirst({
        cacheName: "next-static",
        plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 365 * 24 * 60 * 60 })],
      }),
    },
    // ── Next.js image optimization ──
    {
      matcher: /\/_next\/image\?.*/,
      handler: new StaleWhileRevalidate({
        cacheName: "next-images",
        plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 })],
      }),
    },
  ],
});

serwist.addEventListeners();

// ── Manual offline fallback untuk navigasi ──
// Intercept fetch: jika navigasi gagal (offline), serve /offline.html
(self as unknown as ServiceWorkerGlobalScope & EventTarget).addEventListener(
  "fetch",
  (event: Event) => {
    const fetchEvent = event as Event & {
      request: Request;
      respondWith: (r: Promise<Response>) => void;
    };

    if (fetchEvent.request.mode !== "navigate") return;

    fetchEvent.respondWith(
      fetch(fetchEvent.request).catch(async () => {
        // Coba ambil /dashboard/pos dari cache dulu
        const posCache = await caches.match("/dashboard/pos");
        if (posCache) return posCache;

        // Fallback ke offline.html
        const offlineCache = await caches.match(OFFLINE_URL);
        if (offlineCache) return offlineCache;

        // Last resort: inline HTML
        return new Response(
          `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline</title></head><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f9fafb"><div style="text-align:center;padding:32px"><h1 style="color:#111827">Tidak Ada Koneksi</h1><p style="color:#6b7280">Sambungkan internet lalu <a href="/dashboard/pos">kembali ke kasir</a></p></div></body></html>`,
          { headers: { "Content-Type": "text/html; charset=utf-8" } }
        );
      })
    );
  }
);
