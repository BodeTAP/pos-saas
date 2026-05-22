"use client";

import { useEffect } from "react";
import { CloudUpload, AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOfflineQueue } from "@/hooks/use-offline-queue";
import { toast } from "sonner";

/**
 * Badge kecil di toolbar POS yang menampilkan status offline queue.
 * - Hijau: semua tersinkron
 * - Oranye: ada transaksi pending
 * - Merah: ada transaksi gagal
 */
export function OfflineSyncStatus() {
  const { pendingCount, failedCount, isSyncing, sync, refreshCounts } =
    useOfflineQueue({
      onSyncComplete: (results) => {
        const synced = results.filter((r) => r.status === "SYNCED").length;
        const failed = results.filter((r) => r.status === "FAILED").length;

        if (synced > 0) {
          toast.success(
            `${synced} transaksi offline berhasil disinkronkan.`
          );
        }
        if (failed > 0) {
          toast.error(
            `${failed} transaksi offline gagal disinkronkan. Cek status di bawah.`
          );
        }
        refreshCounts();
      },
    });

  // Refresh counts setiap 30 detik
  useEffect(() => {
    const interval = setInterval(refreshCounts, 30000);
    return () => clearInterval(interval);
  }, [refreshCounts]);

  // Tidak tampilkan jika tidak ada pending/failed
  if (pendingCount === 0 && failedCount === 0) return null;

  const hasFailed = failedCount > 0;
  const total = pendingCount + failedCount;

  return (
    <button
      onClick={() => sync()}
      disabled={isSyncing}
      title={
        hasFailed
          ? `${failedCount} transaksi gagal sync. Klik untuk retry.`
          : `${pendingCount} transaksi menunggu sync. Klik untuk sync sekarang.`
      }
      className={cn(
        "relative flex items-center gap-2 px-3 py-2.5 border rounded-lg text-sm font-medium transition-colors",
        hasFailed
          ? "border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
          : "border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100"
      )}
    >
      {isSyncing ? (
        <RefreshCw className="w-4 h-4 animate-spin" />
      ) : hasFailed ? (
        <AlertCircle className="w-4 h-4" />
      ) : (
        <CloudUpload className="w-4 h-4" />
      )}
      <span className="hidden sm:inline">
        {isSyncing ? "Sync..." : hasFailed ? "Gagal" : "Pending"}
      </span>
      <span
        className={cn(
          "absolute -top-1.5 -right-1.5 text-white text-xs px-1.5 py-0 rounded-full font-medium min-w-[18px] text-center",
          hasFailed ? "bg-red-500" : "bg-orange-500"
        )}
      >
        {total}
      </span>
    </button>
  );
}
