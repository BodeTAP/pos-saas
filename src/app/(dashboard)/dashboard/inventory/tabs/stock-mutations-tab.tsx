"use client";

import { useState, useEffect, useCallback } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown, RefreshCw, Filter } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Pagination } from "@/components/ui/pagination";

interface OutletInfo {
  id: string;
  name: string;
  isMain: boolean;
}

interface StockMutation {
  id: string;
  type: string;
  quantity: number;
  stockBefore: number;
  stockAfter: number;
  note: string | null;
  createdAt: string;
  product: { name: string; sku: string | null; unit: string };
  outlet: { name: string };
}

// BUG 24: removed unused `outlets` prop from interface
interface StockMutationsTabProps {
  selectedOutlet: OutletInfo | null;
}

// BUG 6: added PURCHASE to TYPE_LABELS
const TYPE_LABELS: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  IN: { label: "Masuk", color: "text-green-700 bg-green-100", icon: ArrowUp },
  OUT: { label: "Keluar", color: "text-red-700 bg-red-100", icon: ArrowDown },
  ADJUSTMENT: { label: "Penyesuaian", color: "text-blue-700 bg-blue-100", icon: ArrowUpDown },
  SALE: { label: "Penjualan", color: "text-orange-700 bg-orange-100", icon: ArrowDown },
  RETURN: { label: "Retur", color: "text-purple-700 bg-purple-100", icon: ArrowUp },
  PURCHASE: { label: "Pembelian (PO)", color: "text-teal-700 bg-teal-100", icon: ArrowUp },
};

const PAGE_SIZE = 30;

// BUG 24: removed `outlets` from destructured props
export function StockMutationsTab({ selectedOutlet }: StockMutationsTabProps) {
  const [mutations, setMutations] = useState<StockMutation[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const fetchMutations = useCallback(async () => {
    if (!selectedOutlet) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        outletId: selectedOutlet.id,
        page: String(page),
        limit: String(PAGE_SIZE),
        ...(typeFilter && { type: typeFilter }),
        ...(dateFrom && { dateFrom }),
        ...(dateTo && { dateTo }),
      });
      const res = await fetch(`/api/stock-mutations?${params}`);
      if (res.ok) {
        const data = await res.json();
        setMutations(data.mutations);
        setTotal(data.total);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedOutlet, page, typeFilter, dateFrom, dateTo]);

  useEffect(() => {
    setPage(1);
  }, [selectedOutlet?.id, typeFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchMutations();
  }, [fetchMutations]);

  function handleReset() {
    setTypeFilter("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-gray-900">Riwayat Mutasi Stok</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {selectedOutlet
              ? `Cabang: ${selectedOutlet.name} · ${total} entri`
              : "Pilih cabang"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors",
              showFilters
                ? "border-blue-300 bg-blue-50 text-blue-700"
                : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
            )}
          >
            <Filter className="w-4 h-4" />
            Filter
          </button>
          <button
            onClick={fetchMutations}
            disabled={loading}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tipe Mutasi</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Semua Tipe</option>
                <option value="IN">Masuk</option>
                <option value="OUT">Keluar</option>
                <option value="ADJUSTMENT">Penyesuaian</option>
                <option value="SALE">Penjualan</option>
                <option value="RETURN">Retur</option>
                {/* BUG 6: added PURCHASE filter option */}
                <option value="PURCHASE">Pembelian (PO)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Dari Tanggal</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Sampai Tanggal</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <button
            onClick={handleReset}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Reset filter
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" />
          <span>Memuat data...</span>
        </div>
      ) : mutations.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <ArrowUpDown className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Belum ada riwayat mutasi stok</p>
          <p className="text-sm mt-1">Mutasi akan tercatat saat ada transaksi, penyesuaian, atau transfer stok</p>
        </div>
      ) : (
        <>
          {/* Mobile: Cards */}
          <div className="md:hidden space-y-3">
            {mutations.map((m) => {
              const typeInfo = TYPE_LABELS[m.type] || {
                label: m.type,
                color: "text-gray-700 bg-gray-100",
                icon: ArrowUpDown,
              };
              const Icon = typeInfo.icon;
              return (
                <div key={m.id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{m.product.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {m.product.sku || "Tanpa SKU"} · {m.outlet.name}
                      </p>
                    </div>
                    <span className={cn("text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1 flex-shrink-0", typeInfo.color)}>
                      <Icon className="w-3 h-3" />
                      {typeInfo.label}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                    <div className="text-sm">
                      <span className={cn("font-bold", m.quantity > 0 ? "text-green-600" : "text-red-600")}>
                        {m.quantity > 0 ? "+" : ""}{m.quantity} {m.product.unit}
                      </span>
                      <span className="text-gray-400 text-xs ml-2">
                        {m.stockBefore} → {m.stockAfter}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400">{formatDateTime(m.createdAt)}</span>
                  </div>
                  {m.note && (
                    <p className="text-xs text-gray-500 mt-2 italic">{m.note}</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Desktop: Table */}
          <div className="hidden md:block overflow-hidden rounded-xl border border-gray-200">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Produk</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Cabang</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">Tipe</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Perubahan</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Sebelum</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Sesudah</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Catatan</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Waktu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {mutations.map((m) => {
                    const typeInfo = TYPE_LABELS[m.type] || {
                      label: m.type,
                      color: "text-gray-700 bg-gray-100",
                      icon: ArrowUpDown,
                    };
                    const Icon = typeInfo.icon;
                    return (
                      <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{m.product.name}</p>
                          {m.product.sku && (
                            <p className="text-xs text-gray-400">{m.product.sku}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-500">{m.outlet.name}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn("text-xs px-2 py-1 rounded-full font-medium inline-flex items-center gap-1", typeInfo.color)}>
                            <Icon className="w-3 h-3" />
                            {typeInfo.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={cn("font-semibold", m.quantity > 0 ? "text-green-600" : "text-red-600")}>
                            {m.quantity > 0 ? "+" : ""}{m.quantity} {m.product.unit}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-500">{m.stockBefore}</td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900">{m.stockAfter}</td>
                        <td className="px-4 py-3 text-gray-500 max-w-[200px] truncate">
                          {m.note || "-"}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-400 text-xs whitespace-nowrap">
                          {formatDateTime(m.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {total > PAGE_SIZE && (
            <div className="flex justify-center">
              <div className="flex items-center gap-2 text-sm">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ← Sebelumnya
                </button>
                <span className="text-gray-500">
                  Halaman {page} dari {Math.ceil(total / PAGE_SIZE)}
                </span>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= Math.ceil(total / PAGE_SIZE)}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Berikutnya →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
