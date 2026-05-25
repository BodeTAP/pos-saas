"use client";

import { useEffect, useState, useRef } from "react";
import { Download, X, Smartphone } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "pwa-prompt-dismissed";
const INSTALLED_KEY = "pwa-installed";
const DELAY_MS = 30_000; // 30 detik
const DISMISS_DAYS = 7;

/**
 * Komponen prompt install PWA ke homescreen.
 * - Muncul otomatis setelah 30 detik (timer persistent antar navigasi via timestamp)
 * - User bisa dismiss; tidak akan muncul lagi selama 7 hari
 * - Listen event 'appinstalled' untuk mark sebagai installed permanently
 * - Auto-dismiss saat user batal di native prompt (consistency fix)
 */
export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Cek apakah sudah di-install (standalone mode)
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;

    if (isStandalone) {
      // App sudah berjalan dalam mode standalone — mark sebagai installed
      localStorage.setItem(INSTALLED_KEY, "1");
      return;
    }

    // Cek apakah sudah pernah install
    if (localStorage.getItem(INSTALLED_KEY) === "1") return;

    // Cek apakah sudah pernah dismiss dalam 7 hari terakhir
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const daysSinceDismiss =
        (Date.now() - parseInt(dismissedAt)) / (1000 * 60 * 60 * 24);
      if (daysSinceDismiss < DISMISS_DAYS) return;
    }

    // Deteksi iOS (Safari tidak support beforeinstallprompt)
    const ua = navigator.userAgent;
    const isIOSDevice =
      /iPad|iPhone|iPod/.test(ua) &&
      !(window as { MSStream?: unknown }).MSStream;
    setIsIOS(isIOSDevice);

    // Compute remaining wait time berdasarkan first-visit timestamp
    // Ini memastikan timer "persistent" antar navigasi/refresh
    const FIRST_VISIT_KEY = "pwa-first-visit";
    let firstVisit = parseInt(localStorage.getItem(FIRST_VISIT_KEY) || "0");
    if (!firstVisit) {
      firstVisit = Date.now();
      localStorage.setItem(FIRST_VISIT_KEY, firstVisit.toString());
    }
    const elapsedMs = Date.now() - firstVisit;
    const remainingMs = Math.max(0, DELAY_MS - elapsedMs);

    if (isIOSDevice) {
      // iOS: tampilkan instruksi manual setelah delay
      timerRef.current = setTimeout(() => setShowPrompt(true), remainingMs);
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }

    // Android/Chrome: tangkap event beforeinstallprompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Tampilkan prompt setelah delay
      timerRef.current = setTimeout(() => setShowPrompt(true), remainingMs);
    };

    // Listen 'appinstalled' — mark installed dan sembunyikan prompt
    const handleAppInstalled = () => {
      localStorage.setItem(INSTALLED_KEY, "1");
      setShowPrompt(false);
      setDeferredPrompt(null);
      if (timerRef.current) clearTimeout(timerRef.current);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function handleInstall() {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    deferredPrompt.userChoice
      .then((choice) => {
        if (choice.outcome === "accepted") {
          // 'appinstalled' listener akan menangani persistence
          setShowPrompt(false);
        } else {
          // User dismiss native prompt — set tanggal dismiss kita juga
          localStorage.setItem(DISMISS_KEY, Date.now().toString());
          setShowPrompt(false);
        }
      })
      .finally(() => {
        // deferredPrompt hanya bisa dipakai sekali
        setDeferredPrompt(null);
      });
  }

  function handleDismiss() {
    setShowPrompt(false);
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
  }

  if (!showPrompt) return null;

  // Instruksi iOS
  if (isIOS) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 bg-white rounded-2xl shadow-2xl border border-gray-200 p-4 max-w-md mx-auto">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Smartphone className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">
                Install POS SaaS
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Tap{" "}
                <span className="font-medium text-blue-600">
                  Share (
                  <svg
                    className="inline w-3 h-3"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" />
                  </svg>
                  )
                </span>{" "}
                lalu pilih{" "}
                <span className="font-medium">&quot;Add to Home Screen&quot;</span>
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-gray-400 hover:text-gray-600 p-1 flex-shrink-0"
            aria-label="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // Android/Chrome
  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 bg-white rounded-2xl shadow-2xl border border-gray-200 p-4 max-w-md mx-auto">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Download className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">
              Install POS SaaS
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Tambahkan ke homescreen untuk akses lebih cepat
            </p>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="text-gray-400 hover:text-gray-600 p-1 flex-shrink-0"
          aria-label="Tutup"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={handleDismiss}
          className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Nanti
        </button>
        <button
          onClick={handleInstall}
          className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors"
        >
          Install
        </button>
      </div>
    </div>
  );
}
