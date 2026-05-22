import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import {
  Serwist,
  NetworkFirst,
  CacheFirst,
  StaleWhileRevalidate,
  ExpirationPlugin,
} from "serwist";

declare global {
  interface ServiceWorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const OFFLINE_URL = "/offline.html";

const serwist = new Serwist({
  // Precache semua assets Next.js + tambahkan offline.html secara eksplisit
  precacheEntries: [
    ...(self.__SW_MANIFEST ?? []),
    { url: OFFLINE_URL, revision: "1" },
  ],
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false,

  // Fallback navigasi ke /offline.html saat offline
  fallbacks: {
    entries: [
      {
        url: OFFLINE_URL,
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },

  runtimeCaching: [
    // ── Halaman POS — NetworkFirst ──
    {
      matcher: /\/dashboard\/pos/,
      handler: new NetworkFirst({
        cacheName: "pos-pages",
        plugins: [
          new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 24 * 60 * 60 }),
        ],
        networkTimeoutSeconds: 5,
      }),
    },
    // ── Semua halaman dashboard ──
    {
      matcher: /\/dashboard/,
      handler: new NetworkFirst({
        cacheName: "dashboard-pages",
        plugins: [
          new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 24 * 60 * 60 }),
        ],
        networkTimeoutSeconds: 5,
      }),
    },
    // ── Login page ──
    {
      matcher: /\/login/,
      handler: new NetworkFirst({
        cacheName: "auth-pages",
        plugins: [
          new ExpirationPlugin({ maxEntries: 5, maxAgeSeconds: 24 * 60 * 60 }),
        ],
        networkTimeoutSeconds: 5,
      }),
    },
    // ── API sync data offline ──
    {
      matcher: /\/api\/offline\/sync-data/,
      handler: new StaleWhileRevalidate({
        cacheName: "offline-sync-data",
        plugins: [
          new ExpirationPlugin({ maxEntries: 5, maxAgeSeconds: 24 * 60 * 60 }),
        ],
      }),
    },
    // ── Gambar produk ──
    {
      matcher: /\.(?:png|jpg|jpeg|gif|webp|ico)$/,
      handler: new CacheFirst({
        cacheName: "images",
        plugins: [
          new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 }),
        ],
      }),
    },
    // ── Vercel Blob ──
    {
      matcher: /^https:\/\/.*\.public\.blob\.vercel-storage\.com\/.*/,
      handler: new CacheFirst({
        cacheName: "blob-images",
        plugins: [
          new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 }),
        ],
      }),
    },
    // ── Google Fonts ──
    {
      matcher: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/,
      handler: new CacheFirst({
        cacheName: "google-fonts",
        plugins: [
          new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 }),
        ],
      }),
    },
    // ── Next.js static assets ──
    {
      matcher: /\/_next\/static\/.*/,
      handler: new CacheFirst({
        cacheName: "next-static",
        plugins: [
          new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 365 * 24 * 60 * 60 }),
        ],
      }),
    },
    // ── Next.js image optimization ──
    {
      matcher: /\/_next\/image\?.*/,
      handler: new StaleWhileRevalidate({
        cacheName: "next-images",
        plugins: [
          new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 }),
        ],
      }),
    },
  ],
});

serwist.addEventListeners();
