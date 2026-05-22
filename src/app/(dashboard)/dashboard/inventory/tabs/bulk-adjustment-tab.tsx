"use client";

import { useState, useEffect } from "react";
import { RefreshCw, Save, Search, Package, Plus, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface OutletInfo {
  id: string;
  name: string;
  isMain: boolean;
}

interface ProductStock {
  productId: string;
  productName: string;
  productSku: string | null;
  productUnit: string;
  categoryName: string | null;
  systemStock: number;
  newStock: number | null; // null = tidak diubah
}

interface BulkAdjustmentTabProps {
  selectedOutlet: OutletInfo | null;
  outlets: OutletInfo[];
}

export function BulkAdjustmentTab({ selectedOutlet, outlets }: BulkAdjustmentTabProps) {
  const [products, setProducts] = useState<ProductStock[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [globalNote, setGlobalNote] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [adjustmentMode, setAdjustmentMode] = useState<"set" | "add" | "subtract">("set");

  async function fetchProducts() {
    if (!selectedOutlet) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/stock-opname?outletId=${selectedOutlet.id}`);
      if (res.ok) {
        const data = await res.json();
        setProducts(
          data.items.map((item: {
            productId: string;
            productName: string;
            productSku: string | null;
            productUnit: string;
            categoryName: string | null;
            systemStock: number;
          }) => ({
            ...item,
            newStock: null,
          }))
        );
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOutlet?.id]);

  function updateNewStock(productId: string, value: string) {
    const num = value === "" ? null : parseInt(value);
    setProducts((prev) =>
      prev.map((p) =>
        p.productId === productId
          ? { ...p, newStock: num !== null && !isNaN(num) ? Math.max(0, num) : null }
          : p
      )
    );
  }

  function applyToAll(value: string) {
    const num = parseInt(value);
    if (isNaN(num)) return;
    setProducts((prev) =>
      prev.map((p) => {
        if (adjustmentMode === "set") return { ...p, newStock: Math.max(0, num) };
        if (adjustmentMode === "add") return { ...p, newStock: Math.max(0, p.systemStock + num) };
        if (adjustmentMode === "subtract") return { ...p, newStock: Math.max(0, p.systemStock - num) };
        return p;
      })
    );
  }

  function clearAll() {
    setProducts((prev) => prev.map((p) => ({ ...p, newStock: null })));
  }

  const changedProducts = products.filter(
    (p) => p.newStock !== null && p.newStock !== p.systemStock
  );

  const filteredProducts = products.filter(
    (p) =>
      searchQuery === "" ||
      p.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.productSku && p.productSku.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  async function handleSubmit() {
    if (changedProducts.length === 0) {
      toast.error("Tidak ada perubahan stok yang perlu disimpan.");
      return;
    }

    if (
      !confirm(
        `Konfirmasi penyesuaian stok massal?\n\n${changedProducts.length} produk akan diperbarui.\n\nProses ini tidak dapat dibatalkan.`
      )
    ) {
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        outletId: selectedOutlet!.id,
        adjustments: changedProducts.map((p) => ({
          productId: p.productId,
          newStock: p.newStock!,
        })),
        globalNote: globalNote || undefined,
      };

      const res = await fetch("/api/stock-mutations/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Gagal memproses penyesuaian massal.");
        return;
      }

      toast.success(
        `Berhasil! ${data.adjusted} produk diperbarui${data.skipped > 0 ? `, ${data.skipped} dilewati (tidak ada perubahan)` : ""}.`
      );

      // Refresh data
      await fetchProducts();
      setGlobalNote("");
    } finally {
      setSubmitting(false);
    }
  }

  if (!selectedOutlet) {
    return (
      <div className="text-center py-16 text-gray-400">
        <RefreshCw className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p>Pilih cabang untuk penyesuaian stok massal</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-gray-900">Penyesuaian Stok Massal</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Cabang: {selectedOutlet.name} · Update stok banyak produk sekaligus
          </p>
        </div>
        <button
          onClick={fetchProducts}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm text-gray-600 transition-colors disabled:opacity-50 self-start"
        >
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          Muat Ulang
        </button>
      </div>

      {/* Quick Actions */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-3">
        <p className="text-sm font-medium text-gray-700">Terapkan ke Semua Produk</p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
            {(
              [
                { key: "set", label: "Set ke", icon: Package },
                { key: "add", label: "Tambah", icon: Plus },
                { key: "subtract", label: "Kurangi", icon: Minus },
              ] as const
            ).map((m) => {
              const Icon = m.icon;
              return (
                <button
                  key={m.key}
                  onClick={() => setAdjustmentMode(m.key)}
                  className={cn(
                    "flex items-center gap-1 px-3 py-1.5 font-medium transition-colors",
                    adjustmentMode === m.key
                      ? "bg-blue-600 text-white"
                      : "bg-white text-gray-600 hover:bg-gray-50"
                  )}
                >
                  <Icon className="w-3 h-3" />
                  {m.label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              placeholder="Nilai..."
              className="w-24 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  applyToAll((e.target as HTMLInputElement).value);
                  (e.target as HTMLInputElement).value = "";
                }
              }}
              onBlur={(e) => {
                if (e.target.value) {
                  applyToAll(e.target.value);
                  e.target.value = "";
                }
              }}
            />
            <span className="text-xs text-gray-500">Tekan Enter untuk terapkan</span>
          </div>
          {changedProducts.length > 0 && (
            <button
              onClick={clearAll}
              className="text-xs text-red-500 hover:text-red-700 underline"
            >
              Bersihkan semua
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari produk..."
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Changed count badge */}
      {changedProducts.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 flex items-center justify-between">
          <p className="text-sm text-blue-800 font-medium">
            {changedProducts.length} produk akan diperbarui
          </p>
          <button
            onClick={clearAll}
            className="text-xs text-blue-600 hover:underline"
          >
            Batal semua
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" />
          <span>Memuat data produk...</span>
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Tidak ada produk di cabang ini</p>
        </div>
      ) : (
        <>
          {/* Mobile: Cards */}
          <div className="md:hidden space-y-3">
            {filteredProducts.map((p) => {
              const isChanged = p.newStock !== null && p.newStock !== p.systemStock;
              const diff = p.newStock !== null ? p.newStock - p.systemStock : null;

              return (
                <div
                  key={p.productId}
                  className={cn(
                    "rounded-xl border p-4",
                    isChanged ? "border-blue-200 bg-blue-50" : "border-gray-200 bg-white"
                  )}
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <p className="font-medium text-gray-900">{p.productName}</p>
                      <p className="text-xs text-gray-500">
                        {p.productSku || "Tanpa SKU"} · {p.categoryName || "Tanpa Kategori"}
                      </p>
                    </div>
                    {isChanged && diff !== null && (
                      <span
                        className={cn(
                          "text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0",
                          diff > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                        )}
                      >
                        {diff > 0 ? "+" : ""}{diff}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <p className="text-xs text-gray-500 mb-1">Stok Saat Ini</p>
                      <p className="font-semibold text-gray-700">
                        {p.systemStock} {p.productUnit}
                      </p>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-500 mb-1">Stok Baru</p>
                      <input
                        type="number"
                        min="0"
                        value={p.newStock ?? ""}
                        onChange={(e) => updateNewStock(p.productId, e.target.value)}
                        placeholder="Isi..."
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
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
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Kategori</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Stok Saat Ini</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600 w-36">Stok Baru</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Perubahan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredProducts.map((p) => {
                    const isChanged = p.newStock !== null && p.newStock !== p.systemStock;
                    const diff = p.newStock !== null ? p.newStock - p.systemStock : null;

                    return (
                      <tr
                        key={p.productId}
                        className={cn(
                          "transition-colors",
                          isChanged ? "bg-blue-50" : "hover:bg-gray-50"
                        )}
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{p.productName}</p>
                          {p.productSku && (
                            <p className="text-xs text-gray-400">{p.productSku}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-500">{p.categoryName || "-"}</td>
                        <td className="px-4 py-3 text-right font-medium text-gray-700">
                          {p.systemStock} {p.productUnit}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <input
                            type="number"
                            min="0"
                            value={p.newStock ?? ""}
                            onChange={(e) => updateNewStock(p.productId, e.target.value)}
                            placeholder="Isi..."
                            className="w-28 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          {diff !== null ? (
                            <span
                              className={cn(
                                "font-semibold",
                                diff > 0
                                  ? "text-green-600"
                                  : diff < 0
                                  ? "text-red-600"
                                  : "text-gray-400"
                              )}
                            >
                              {diff > 0 ? "+" : ""}{diff}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Note & Submit */}
          <div className="space-y-3 pt-2 border-t border-gray-200">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Catatan (opsional)
              </label>
              <input
                type="text"
                value={globalNote}
                onChange={(e) => setGlobalNote(e.target.value)}
                placeholder="Contoh: Restock dari supplier, Koreksi stok..."
                maxLength={200}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                {changedProducts.length} produk akan diperbarui
              </p>
              <button
                onClick={handleSubmit}
                disabled={submitting || changedProducts.length === 0}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-5 py-2.5 rounded-xl font-medium text-sm transition-colors"
              >
                {submitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {submitting ? "Menyimpan..." : "Simpan Perubahan"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
