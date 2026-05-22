import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist, NetworkFirst, CacheFirst, StaleWhileRevalidate, ExpirationPlugin } from "serwist";

// Deklarasi global untuk TypeScript
declare global {
  interface ServiceWorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const OFFLINE_FALLBACK_URL = "/offline.html";

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  // Fallback saat navigasi offline dan halaman tidak ada di cache
  fallbacks: {
    entries: [
      {
        url: OFFLINE_FALLBACK_URL,
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },

  runtimeCaching: [
    // ── Halaman POS — NetworkFirst (paling penting untuk offline) ──
    {
      matcher: /^https?:\/\/.*\/dashboard\/pos$/,
      handler: new NetworkFirst({
        cacheName: "pos-pages",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 10,
            maxAgeSeconds: 24 * 60 * 60, // 24 jam
          }),
        ],
        networkTimeoutSeconds: 5,
      }),
    },

    // ── Halaman dashboard lain — NetworkFirst dengan fallback ──
    {
      matcher: /^https?:\/\/.*\/dashboard\/.*/,
      handler: new NetworkFirst({
        cacheName: "dashboard-pages",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 20,
            maxAgeSeconds: 24 * 60 * 60,
          }),
        ],
        networkTimeoutSeconds: 5,
      }),
    },

    // ── API sync data offline — StaleWhileRevalidate ──
    {
      matcher: /^https?:\/\/.*\/api\/offline\/sync-data/,
      handler: new StaleWhileRevalidate({
        cacheName: "offline-sync-data",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 5,
            maxAgeSeconds: 24 * 60 * 60, // 24 jam
          }),
        ],
      }),
    },

    // ── Gambar produk — Cache First, tahan lama ──
    {
      matcher: /\.(?:png|jpg|jpeg|gif|webp|ico)$/,
      handler: new CacheFirst({
        cacheName: "images",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 200,
            maxAgeSeconds: 7 * 24 * 60 * 60, // 7 hari
          }),
        ],
      }),
    },

    // ── Vercel Blob images ──
    {
      matcher: /^https:\/\/.*\.public\.blob\.vercel-storage\.com\/.*/,
      handler: new CacheFirst({
        cacheName: "blob-images",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 200,
            maxAgeSeconds: 7 * 24 * 60 * 60, // 7 hari
          }),
        ],
      }),
    },

    // ── Font Google ──
    {
      matcher: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/,
      handler: new CacheFirst({
        cacheName: "google-fonts",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 10,
            maxAgeSeconds: 365 * 24 * 60 * 60, // 1 tahun
          }),
        ],
      }),
    },

    // ── Static assets Next.js (_next/static) ──
    {
      matcher: /\/_next\/static\/.*/,
      handler: new CacheFirst({
        cacheName: "next-static",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 100,
            maxAgeSeconds: 365 * 24 * 60 * 60,
          }),
        ],
      }),
    },

    // ── Next.js image optimization ──
    {
      matcher: /\/_next\/image\?.*/,
      handler: new StaleWhileRevalidate({
        cacheName: "next-images",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 100,
            maxAgeSeconds: 7 * 24 * 60 * 60,
          }),
        ],
      }),
    },
  ],
});

serwist.addEventListeners();
