"use client";

import { useEffect, useRef } from "react";
import { saveOfflinePin } from "@/lib/offline-pin";

interface PinSyncResponse {
  userId: string;
  hasPinHash: boolean;
  pinHash?: string;
  expiresAt?: string;
}

/**
 * Hook untuk sinkronisasi PIN offline kasir ke IndexedDB.
 * Dipanggil di POS — kasir fetch PIN hash miliknya saat online,
 * disimpan di IndexedDB untuk verifikasi offline.
 *
 * Hanya jalan saat online dan untuk role KASIR.
 */
export function useOfflinePinSync(userId: string, role: string) {
  const syncedRef = useRef(false);

  useEffect(() => {
    // Hanya untuk KASIR (Owner/SuperAdmin tidak butuh PIN offline)
    if (role !== "KASIR") return;
    if (typeof window === "undefined" || !navigator.onLine) return;
    if (syncedRef.current) return;

    syncedRef.current = true;
    fetch("/api/offline/set-pin", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then(async (data: PinSyncResponse | null) => {
        if (data?.hasPinHash && data.pinHash && data.expiresAt) {
          await saveOfflinePin(userId, data.pinHash, data.expiresAt);
        }
      })
      .catch(() => {
        // Diam saja — PIN belum diset bukan error fatal
      });
  }, [userId, role]);
}
