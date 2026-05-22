"use client";

import { useEffect, useState } from "react";
import { WifiOff, Wifi, RefreshCw, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { isSyncStale, SYNC_KEYS } from "@/lib/offline-db";

interface OfflineIndicatorProps {
  onSyncRequest?: () => void;
}

export function OfflineIndicator({ onSyncRequest }: OfflineIndicatorProps) {
  const [isOnline, setIsOnline] = useState(true);
  const [isStale, setIsStale] = useState(false);
  const [justCameOnline, setJustCameOnline] = useState(false);

  useEffect(() => {
    // Set initial state
    setIsOnline(navigator.onLine);

    // Cek apakah data sudah stale
    isSyncStale(SYNC_KEYS.PRODUCTS).then(setIsStale);

    const handleOnline = () => {
      setIsOnline(true);
      setJustCameOnline(true);
      // Hilangkan notif "kembali online" setelah 3 detik
      setTimeout(() => setJustCameOnline(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setJustCameOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Tidak tampilkan apa-apa jika online dan data fresh
  if (isOnline && !isStale && !justCameOnline) return null;

  // Baru kembali online
  if (justCameOnline) {
    return (
      <div className="fixed bottom-20 lg:bottom-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-2">
        <div className="flex items-center gap-2 bg-green-600 text-white px-4 py-2.5 rounded-full shadow-lg text-sm font-medium">
          <Wifi className="w-4 h-4" />
          <span>Kembali online — menyinkronkan data...</span>
        </div>
      </div>
    );
  }

  // Data stale tapi masih online
  if (isOnline && isStale) {
    return (
      <div className="fixed bottom-20 lg:bottom-4 left-1/2 -translate-x-1/2 z-50">
        <div className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2.5 rounded-full shadow-lg text-sm font-medium">
          <AlertTriangle className="w-4 h-4" />
          <span>Data produk sudah lama</span>
          <button
            onClick={onSyncRequest}
            className="flex items-center gap-1 bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded-full text-xs transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Perbarui
          </button>
        </div>
      </div>
    );
  }

  // Offline
  if (!isOnline) {
    return (
      <div className="fixed bottom-20 lg:bottom-4 left-1/2 -translate-x-1/2 z-50">
        <div className="flex items-center gap-2 bg-gray-800 text-white px-4 py-2.5 rounded-full shadow-lg text-sm font-medium">
          <WifiOff className="w-4 h-4 text-red-400" />
          <span>Mode Offline</span>
          <span className="text-gray-400 text-xs">Data dari cache lokal</span>
        </div>
      </div>
    );
  }

  return null;
}

/**
 * Banner offline di atas halaman POS (lebih mencolok)
 */
export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="bg-orange-500 text-white px-4 py-2 flex items-center justify-center gap-2 text-xs font-medium">
      <WifiOff className="w-3.5 h-3.5" />
      <span>Mode Offline — Transaksi akan disinkronkan saat internet kembali</span>
    </div>
  );
}
