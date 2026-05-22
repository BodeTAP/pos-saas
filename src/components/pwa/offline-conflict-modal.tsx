"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, X, RefreshCw, CheckCircle, XCircle, Clock } from "lucide-react";
import { getAllQueueItems, retryFailedQueue } from "@/lib/offline-queue";
import type { OfflineQueueItem } from "@/lib/offline-db";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface OfflineConflictModalProps {
  onClose: () => void;
}

const STATUS_CONFIG = {
  PENDING_SYNC: { label: "Menunggu", color: "text-orange-700 bg-orange-100", icon: Clock },
  SYNCING: { label: "Menyinkronkan", color: "text-blue-700 bg-blue-100", icon: RefreshCw },
  SYNCED: { label: "Tersinkron", color: "text-green-700 bg-green-100", icon: CheckCircle },
  FAILED: { label: "Gagal", color: "text-red-700 bg-red-100", icon: XCircle },
};

/**
 * Modal untuk melihat dan mengelola offline transaction queue.
 * Menampilkan semua transaksi offline beserta statusnya.
 * Owner/Kasir bisa retry transaksi yang gagal.
 */
export function OfflineConflictModal({ onClose }: OfflineConflictModalProps) {
  const [items, setItems] = useState<OfflineQueueItem[]>([]);
  const [isRetrying, setIsRetrying] = useState(false);
  const [loading, setLoading] = useState(true);

  async function loadItems() {
    setLoading(true);
    try {
      const all = await getAllQueueItems();
      setItems(all);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadItems();
  }, []);

  async function handleRetry() {
    setIsRetrying(true);
    try {
      const results = await retryFailedQueue();
      const synced = results.filter((r) => r.status === "SYNCED").length;
      const failed = results.filter((r) => r.status === "FAILED").length;

      if (synced > 0) toast.success(`${synced} transaksi berhasil disinkronkan.`);
      if (failed > 0) toast.error(`${failed} transaksi masih gagal.`);

      await loadItems();
    } finally {
      setIsRetrying(false);
    }
  }

  const failedCount = items.filter((i) => i.status === "FAILED").length;
  const pendingCount = items.filter((i) => i.status === "PENDING_SYNC").length;
  const syncedCount = items.filter((i) => i.status === "SYNCED").length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-500" />
            <h2 className="font-semibold text-gray-900">Transaksi Offline</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3 p-4 border-b border-gray-100">
          <div className="text-center">
            <p className="text-2xl font-bold text-orange-600">{pendingCount}</p>
            <p className="text-xs text-gray-500">Menunggu</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-red-600">{failedCount}</p>
            <p className="text-xs text-gray-500">Gagal</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{syncedCount}</p>
            <p className="text-xs text-gray-500">Tersinkron</p>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-gray-400">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" />
              Memuat...
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <CheckCircle className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>Tidak ada transaksi offline</p>
            </div>
          ) : (
            items.map((item) => {
              const statusCfg = STATUS_CONFIG[item.status];
              const StatusIcon = statusCfg.icon;
              const payload = (() => {
                try {
                  return JSON.parse(item.payload) as { total: number; paymentMethod: string; items: Array<{ productName: string; quantity: number }> };
                } catch {
                  return null;
                }
              })();

              return (
                <div
                  key={item.id}
                  className={cn(
                    "rounded-xl border p-4",
                    item.status === "FAILED"
                      ? "border-red-200 bg-red-50"
                      : item.status === "SYNCED"
                      ? "border-green-200 bg-green-50"
                      : "border-orange-200 bg-orange-50"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">
                        {item.invoiceNumber}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {formatDateTime(new Date(item.createdAt))}
                      </p>
                      {payload && (
                        <p className="text-xs text-gray-600 mt-1">
                          {payload.items.slice(0, 2).map((i) => `${i.productName} ×${i.quantity}`).join(", ")}
                          {payload.items.length > 2 && ` +${payload.items.length - 2} lainnya`}
                        </p>
                      )}
                    </div>
                    <span className={cn("text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1 flex-shrink-0", statusCfg.color)}>
                      <StatusIcon className="w-3 h-3" />
                      {statusCfg.label}
                    </span>
                  </div>

                  {item.error && (
                    <div className="mt-2 text-xs text-red-600 bg-red-100 rounded px-2 py-1">
                      {item.error}
                      {item.retryCount >= 3 && (
                        <span className="ml-1 font-medium">(Maks retry tercapai)</span>
                      )}
                    </div>
                  )}

                  {item.syncedAt && (
                    <p className="text-xs text-green-600 mt-1">
                      Tersinkron: {formatDateTime(new Date(item.syncedAt))}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 flex gap-2">
          {failedCount > 0 && (
            <button
              onClick={handleRetry}
              disabled={isRetrying || !navigator.onLine}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium py-2.5 rounded-xl text-sm transition-colors"
            >
              {isRetrying ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> Menyinkronkan...</>
              ) : (
                <><RefreshCw className="w-4 h-4" /> Retry {failedCount} Gagal</>
              )}
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium py-2.5 rounded-xl text-sm transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
