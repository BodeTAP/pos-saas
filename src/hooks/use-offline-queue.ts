"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import {
  syncOfflineQueue,
  getPendingQueueCount,
  getFailedQueueCount,
  cleanupOldQueue,
  type SyncResult,
} from "@/lib/offline-queue";

interface UseOfflineQueueOptions {
  onSyncComplete?: (results: SyncResult[]) => void;
}

/**
 * Hook untuk mengelola offline transaction queue.
 * - Auto sync saat koneksi kembali online
 * - Expose pendingCount dan failedCount untuk UI
 */
export function useOfflineQueue(options: UseOfflineQueueOptions = {}) {
  const { onSyncComplete } = options;
  const syncingRef = useRef(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // Refresh counts
  const refreshCounts = useCallback(async () => {
    const [pending, failed] = await Promise.all([
      getPendingQueueCount(),
      getFailedQueueCount(),
    ]);
    setPendingCount(pending);
    setFailedCount(failed);
  }, []);

  // Sync queue ke server
  const sync = useCallback(async () => {
    if (syncingRef.current || !navigator.onLine) return;
    const pending = await getPendingQueueCount();
    if (pending === 0) return;

    syncingRef.current = true;
    setIsSyncing(true);
    try {
      const results = await syncOfflineQueue();
      await refreshCounts();
      if (results.length > 0) {
        onSyncComplete?.(results);
      }
      // Cleanup queue lama setelah sync
      await cleanupOldQueue();
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }
  }, [onSyncComplete, refreshCounts]);

  // Init: load counts
  useEffect(() => {
    refreshCounts();
  }, [refreshCounts]);

  // Auto sync saat online
  useEffect(() => {
    const handleOnline = () => {
      // Delay sedikit agar koneksi stabil
      setTimeout(() => sync(), 1500);
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [sync]);

  return { pendingCount, failedCount, isSyncing, sync, refreshCounts };
}
