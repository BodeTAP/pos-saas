"use client";

import { useEffect } from "react";

/**
 * Register service worker manual (public/sw.js).
 * Aktif di semua environment karena sw.js adalah static file.
 */
export function SWRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        console.log("[SW] Registered, scope:", registration.scope);

        // Cek update setiap 1 jam
        setInterval(() => registration.update(), 60 * 60 * 1000);
      })
      .catch((err) => {
        console.warn("[SW] Registration failed:", err);
      });
  }, []);

  return null;
}
