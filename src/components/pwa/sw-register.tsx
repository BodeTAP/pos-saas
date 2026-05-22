"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Register service worker manual (public/sw.js).
 * Juga trigger cache halaman POS saat dikunjungi.
 */
export function SWRegister() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        console.log("[SW] Registered, scope:", registration.scope);

        // Setelah SW aktif, minta SW untuk cache halaman POS
        const sw = registration.active || registration.installing || registration.waiting;
        if (sw) {
          sw.postMessage({ type: "CACHE_POS_PAGE" });
        }

        // Cek update setiap 1 jam
        setInterval(() => registration.update(), 60 * 60 * 1000);
      })
      .catch((err) => {
        console.warn("[SW] Registration failed:", err);
      });
  }, []);

  // Setiap kali user mengunjungi /dashboard/pos, pastikan ter-cache
  useEffect(() => {
    if (!pathname?.includes("/dashboard/pos")) return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.ready.then((registration) => {
      const sw = registration.active;
      if (sw) {
        sw.postMessage({ type: "CACHE_POS_PAGE" });
      }
    });
  }, [pathname]);

  return null;
}
