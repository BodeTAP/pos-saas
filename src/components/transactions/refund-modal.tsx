"use client";

import { useState } from "react";
import { toast } from "@/components/ui/toaster";
import { X, Loader2, RotateCcw, AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface RefundModalProps {
  transaction: {
    id: string;
    invoiceNumber: string;
    total: number;
  };
  onClose: () => void;
  onSuccess: () => void;
}

export function RefundModal({ transaction, onClose, onSuccess }: RefundModalProps) {
  const [reason, setReason] = useState("");
  const [restoreStock, setRestoreStock] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  async function handleRefund() {
    if (!reason.trim()) {
      toast.error("Alasan retur wajib diisi.");
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`/api/transactions/${transaction.id}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim(), restoreStock }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Gagal memproses retur.");
        return;
      }
      toast.success("Transaksi berhasil diretur.");
      onSuccess();
    } catch {
      toast.error("Terjadi kesalahan koneksi.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
            <RotateCcw className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">Retur Transaksi</h2>
            <p className="text-sm text-gray-500">{transaction.invoiceNumber}</p>
          </div>
          <button onClick={onClose} className="ml-auto text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            Transaksi senilai{" "}
            <strong>{formatCurrency(transaction.total)}</strong> akan dibatalkan.
            Tindakan ini tidak bisa diurungkan.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Alasan Retur <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Contoh: Produk rusak, salah item, permintaan pelanggan..."
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={restoreStock}
              onChange={(e) => setRestoreStock(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <div>
              <p className="text-sm font-medium text-gray-700">Kembalikan stok produk</p>
              <p className="text-xs text-gray-500">
                Stok semua item dalam transaksi ini akan dikembalikan
              </p>
            </div>
          </label>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50"
          >
            Batal
          </button>
          <button
            onClick={handleRefund}
            disabled={isLoading || !reason.trim()}
            className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RotateCcw className="w-4 h-4" />
            )}
            Proses Retur
          </button>
        </div>
      </div>
    </div>
  );
}
