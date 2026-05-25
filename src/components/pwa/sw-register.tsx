"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { toast } from "@/components/ui/toaster";

/**
 * Register service worker manual (public/sw.js).
 * - Trigger cache halaman POS saat dikunjungi
 * - Tampilkan toast saat ada update SW, user bisa apply atau abaikan
 */
export function SWRegister() {
  const pathname = usePathname();
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    let registration: ServiceWorkerRegistration | null = null;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        registration = reg;
        console.log("[SW] Registered, scope:", reg.scope);

        // Setelah SW aktif, minta SW untuk cache halaman POS
        const sw = reg.active || reg.installing || reg.waiting;
        if (sw) {
          sw.postMessage({ type: "CACHE_POS_PAGE" });
        }

        // Jika sudah ada SW yang menunggu (waiting), tampilkan toast update
        if (reg.waiting) {
          setWaitingWorker(reg.waiting);
        }

        // Listen untuk SW baru yang sedang installing
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            // Saat installation selesai dan ada controller (= ada SW lama yang aktif)
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              setWaitingWorker(newWorker);
            }
          });
        });

        // Cek update setiap 1 jam
        const updateInterval = setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
        return () => clearInterval(updateInterval);
      })
      .catch((err) => {
        console.warn("[SW] Registration failed:", err);
      });

    // Reload halaman saat controller berubah (= user setuju update)
    let refreshing = false;
    const handleControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);

  // Setiap kali user mengunjungi /dashboard/pos, pastikan ter-cache
  useEffect(() => {
    if (!pathname?.includes("/dashboard/pos")) return;
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker.ready.then((registration) => {
      const sw = registration.active;
      if (sw) {
        sw.postMessage({ type: "CACHE_POS_PAGE" });
      }
    });
  }, [pathname]);

  // Tampilkan toast update saat ada SW baru menunggu
  useEffect(() => {
    if (!waitingWorker) return;

    const toastId = toast.info(
      "Versi baru tersedia. Refresh untuk memperbarui aplikasi.",
      {
        duration: Infinity,
        action: {
          label: "Update Sekarang",
          onClick: () => {
            waitingWorker.postMessage({ type: "SKIP_WAITING" });
            // controllerchange listener akan reload halaman
          },
        },
      }
    );

    return () => {
      toast.dismiss(toastId);
    };
  }, [waitingWorker]);

  return null;
}
