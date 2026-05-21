"use client";

import { useState, useEffect } from "react";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { toast } from "@/components/ui/toaster";
import {
  Clock,
  X,
  Loader2,
  CheckCircle,
  LogIn,
  LogOut,
} from "lucide-react";

interface Shift {
  id: string;
  status: "OPEN" | "CLOSED";
  openedAt: Date | string;
  closedAt?: Date | string | null;
  openingCash: number;
  closingCash?: number | null;
  totalTransactions: number;
  totalRevenue: number;
  totalCash: number;
  totalNonCash: number;
  note?: string | null;
}

interface ShiftModalProps {
  onClose: () => void;
  onShiftChange: (shift: Shift | null) => void;
}

export function ShiftModal({ onClose, onShiftChange }: ShiftModalProps) {
  const [currentShift, setCurrentShift] = useState<Shift | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [openingCash, setOpeningCash] = useState("0");
  const [closingCash, setClosingCash] = useState("0");
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [view, setView] = useState<"main" | "close-confirm">("main");

  useEffect(() => {
    fetchCurrentShift();
  }, []);

  async function fetchCurrentShift() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/shifts");
      const data = await res.json();
      setCurrentShift(data.shift || null);
      if (data.shift) {
        setClosingCash(data.shift.openingCash.toString());
      }
    } catch {
      toast.error("Gagal memuat data shift.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleOpenShift() {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          openingCash: parseFloat(openingCash) || 0,
          note: note || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Gagal membuka shift.");
        return;
      }
      toast.success("Shift berhasil dibuka.");
      setCurrentShift(data.shift);
      onShiftChange(data.shift);
    } catch {
      toast.error("Terjadi kesalahan.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCloseShift() {
    if (!currentShift) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/shifts/${currentShift.id}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          closingCash: parseFloat(closingCash) || 0,
          note: note || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Gagal menutup shift.");
        return;
      }
      toast.success("Shift berhasil ditutup.");
      setCurrentShift(data.shift);
      onShiftChange(null);
      setView("main");
    } catch {
      toast.error("Terjadi kesalahan.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Manajemen Shift</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : currentShift && currentShift.status === "OPEN" ? (
            // Shift sedang berjalan
            view === "main" ? (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="font-semibold text-green-800">Shift Sedang Berjalan</span>
                  </div>
                  <div className="space-y-1.5 text-sm text-green-700">
                    <div className="flex justify-between">
                      <span>Dibuka</span>
                      <span className="font-medium">
                        {formatDateTime(new Date(currentShift.openedAt))}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Kas Awal</span>
                      <span className="font-medium">
                        {formatCurrency(currentShift.openingCash)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-blue-50 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-blue-700">
                      {currentShift.totalTransactions}
                    </p>
                    <p className="text-xs text-blue-600 mt-0.5">Transaksi</p>
                  </div>
                  <div className="bg-green-50 rounded-xl p-3 text-center">
                    <p className="text-lg font-bold text-green-700">
                      {formatCurrency(currentShift.totalRevenue)}
                    </p>
                    <p className="text-xs text-green-600 mt-0.5">Pendapatan</p>
                  </div>
                </div>

                <button
                  onClick={() => setView("close-confirm")}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Tutup Shift
                </button>
              </div>
            ) : (
              // Konfirmasi tutup shift
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Masukkan jumlah kas akhir dan tutup shift.
                </p>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Kas Akhir (Rp)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={closingCash}
                    onChange={(e) => setClosingCash(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Catatan (opsional)
                  </label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    placeholder="Catatan penutupan shift..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setView("main")}
                    className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleCloseShift}
                    disabled={isSubmitting}
                    className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <LogOut className="w-4 h-4" />
                    )}
                    Tutup Shift
                  </button>
                </div>
              </div>
            )
          ) : (
            // Belum ada shift / shift sudah ditutup
            <div className="space-y-4">
              {currentShift?.status === "CLOSED" && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-600">
                  <p className="font-medium text-gray-700 mb-2">Shift Terakhir</p>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span>Ditutup</span>
                      <span>
                        {currentShift.closedAt
                          ? formatDateTime(new Date(currentShift.closedAt))
                          : "-"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Pendapatan</span>
                      <span className="font-medium text-green-700">
                        {formatCurrency(currentShift.totalRevenue)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Transaksi</span>
                      <span>{currentShift.totalTransactions}</span>
                    </div>
                  </div>
                </div>
              )}

              <p className="text-sm text-gray-600">
                Buka shift baru untuk mulai menerima transaksi.
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kas Awal (Rp)
                </label>
                <input
                  type="number"
                  min={0}
                  value={openingCash}
                  onChange={(e) => setOpeningCash(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Catatan (opsional)
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Catatan pembukaan shift..."
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                onClick={handleOpenShift}
                disabled={isSubmitting}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <LogIn className="w-4 h-4" />
                )}
                Buka Shift
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
