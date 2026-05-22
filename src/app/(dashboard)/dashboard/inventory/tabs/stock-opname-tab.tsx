"use client";

import { useState, useEffect } from "react";
import { ClipboardList, RefreshCw, CheckCircle, AlertTriangle, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface OutletInfo {
  id: string;
  name: string;
  isMain: boolean;
}

interface OpnameItem {
  productId: string;
  productName: string;
  productSku: string | null;
  productUnit: string;
  categoryName: string | null;
  systemStock: number;
  minStock: number;
  physicalStock: number | null; // null = belum diisi
}

interface StockOpnameTabProps {
  selectedOutlet: OutletInfo | null;
  outlets: OutletInfo[];
}

export function StockOpnameTab({ selectedOutlet, outlets }: StockOpnameTabProps) {
  const [items, setItems] = useState<OpnameItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  async function fetchOpnameData() {
    if (!selectedOutlet) return;
    setLoading(true);
    setSubmitted(false);
    try {
      const res = await fetch(`/api/stock-opname?outletId=${selectedOutlet.id}`);
      if (res.ok) {
        const data = await res.json();
        setItems(
          data.items.map((item: Omit<OpnameItem, "physicalStock">) => ({
            ...item,
            physicalStock: null,
          }))
        );
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchOpnameData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOutlet?.id]);

  function updatePhysicalStock(productId: string, value: string) {
    const num = value === "" ? null : parseInt(value);
    setItems((prev) =>
      prev.map((item) =>
        item.productId === productId
          ? { ...item, physicalStock: num !== null && !isNaN(num) ? Math.max(0, num) : null }
          : item
      )
    );
  }

  const filledCount = items.filter((i) => i.physicalStock !== null).length;
  const varianceItems = items.filter(
    (i) => i.physicalStock !== null && i.physicalStock !== i.systemStock
  );
  const totalVariance = varianceItems.reduce(
    (sum, i) => sum + Math.abs((i.physicalStock ?? 0) - i.systemStock),
    0
  );

  const filteredItems = items.filter(
    (i) =>
      searchQuery === "" ||
      i.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (i.productSku && i.productSku.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  async function handleSubmit() {
    if (filledCount === 0) {
      toast.error("Isi minimal 1 stok fisik terlebih dahulu.");
      return;
    }

    if (
      !confirm(
        `Konfirmasi stock opname?\n\n${filledCount} produk akan diperbarui.\nTotal selisih: ${totalVariance} unit.\n\nProses ini tidak dapat dibatalkan.`
      )
    ) {
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        outletId: selectedOutlet!.id,
        items: items
          .filter((i) => i.physicalStock !== null)
          .map((i) => ({
            productId: i.productId,
            physicalStock: i.physicalStock!,
          })),
        note: note || undefined,
      };

      const res = await fetch("/api/stock-opname", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Gagal memproses stock opname.");
        return;
      }

      toast.success(
        `Stock opname berhasil! ${data.processed} produk diperbarui, total selisih ${data.totalVariance} unit.`
      );
      setSubmitted(true);
      // Refresh data
      await fetchOpnameData();
      setNote("");
    } finally {
      setSubmitting(false);
    }
  }

  if (!selectedOutlet) {
    return (
      <div className="text-center py-16 text-gray-400">
        <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p>Pilih cabang untuk memulai stock opname</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-gray-900">Stock Opname</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Cabang: {selectedOutlet.name} · Input stok fisik hasil hitung manual
          </p>
        </div>
        <button
          onClick={fetchOpnameData}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm text-gray-600 transition-colors disabled:opacity-50 self-start"
        >
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          Muat Ulang
        </button>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <p className="font-medium mb-1">Cara menggunakan Stock Opname:</p>
        <ol className="list-decimal list-inside space-y-1 text-blue-700">
          <li>Hitung stok fisik setiap produk secara manual</li>
          <li>Isi kolom &quot;Stok Fisik&quot; sesuai hasil hitungan</li>
          <li>Produk yang tidak diisi akan diabaikan (tidak berubah)</li>
          <li>Klik &quot;Simpan Opname&quot; untuk menerapkan perubahan</li>
        </ol>
      </div>

      {/* Progress & Variance Summary */}
      {filledCount > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-green-50 rounded-xl border border-green-200 p-3 text-center">
            <p className="text-xl font-bold text-green-700">{filledCount}</p>
            <p className="text-xs text-green-600">Produk Diisi</p>
          </div>
          <div className="bg-orange-50 rounded-xl border border-orange-200 p-3 text-center">
            <p className="text-xl font-bold text-orange-700">{varianceItems.length}</p>
            <p className="text-xs text-orange-600">Ada Selisih</p>
          </div>
          <div className="bg-blue-50 rounded-xl border border-blue-200 p-3 text-center">
            <p className="text-xl font-bold text-blue-700">{totalVariance}</p>
            <p className="text-xs text-blue-600">Total Selisih Unit</p>
          </div>
        </div>
      )}

      {/* Search */}
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Cari produk..."
        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" />
          <span>Memuat data produk...</span>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Tidak ada produk di cabang ini</p>
        </div>
      ) : (
        <>
          {/* Mobile: Cards */}
          <div className="md:hidden space-y-3">
            {filteredItems.map((item) => {
              const hasVariance =
                item.physicalStock !== null && item.physicalStock !== item.systemStock;
              const variance =
                item.physicalStock !== null ? item.physicalStock - item.systemStock : null;

              return (
                <div
                  key={item.productId}
                  className={cn(
                    "rounded-xl border p-4",
                    hasVariance
                      ? "border-orange-200 bg-orange-50"
                      : item.physicalStock !== null
                      ? "border-green-200 bg-green-50"
                      : "border-gray-200 bg-white"
                  )}
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <p className="font-medium text-gray-900">{item.productName}</p>
                      <p className="text-xs text-gray-500">
                        {item.productSku || "Tanpa SKU"} · {item.categoryName || "Tanpa Kategori"}
                      </p>
                    </div>
                    {item.physicalStock !== null && (
                      hasVariance ? (
                        <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0" />
                      ) : (
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                      )
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <p className="text-xs text-gray-500 mb-1">Stok Sistem</p>
                      <p className="font-semibold text-gray-700">
                        {item.systemStock} {item.productUnit}
                      </p>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-500 mb-1">Stok Fisik</p>
                      <input
                        type="number"
                        min="0"
                        value={item.physicalStock ?? ""}
                        onChange={(e) => updatePhysicalStock(item.productId, e.target.value)}
                        placeholder="Isi..."
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    {variance !== null && (
                      <div className="flex-1">
                        <p className="text-xs text-gray-500 mb-1">Selisih</p>
                        <p
                          className={cn(
                            "font-semibold text-sm",
                            variance > 0
                              ? "text-green-600"
                              : variance < 0
                              ? "text-red-600"
                              : "text-gray-500"
                          )}
                        >
                          {variance > 0 ? "+" : ""}{variance}
                        </p>
                      </div>
                    )}
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
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Stok Sistem</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600 w-36">Stok Fisik</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Selisih</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredItems.map((item) => {
                    const hasVariance =
                      item.physicalStock !== null && item.physicalStock !== item.systemStock;
                    const variance =
                      item.physicalStock !== null ? item.physicalStock - item.systemStock : null;

                    return (
                      <tr
                        key={item.productId}
                        className={cn(
                          "transition-colors",
                          hasVariance
                            ? "bg-orange-50"
                            : item.physicalStock !== null
                            ? "bg-green-50"
                            : "hover:bg-gray-50"
                        )}
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{item.productName}</p>
                          {item.productSku && (
                            <p className="text-xs text-gray-400">{item.productSku}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {item.categoryName || "-"}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-gray-700">
                          {item.systemStock} {item.productUnit}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <input
                            type="number"
                            min="0"
                            value={item.physicalStock ?? ""}
                            onChange={(e) => updatePhysicalStock(item.productId, e.target.value)}
                            placeholder="Isi..."
                            className="w-28 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          {variance !== null ? (
                            <span
                              className={cn(
                                "font-semibold",
                                variance > 0
                                  ? "text-green-600"
                                  : variance < 0
                                  ? "text-red-600"
                                  : "text-gray-400"
                              )}
                            >
                              {variance > 0 ? "+" : ""}{variance}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {item.physicalStock !== null &&
                            (hasVariance ? (
                              <AlertTriangle className="w-4 h-4 text-orange-500 mx-auto" />
                            ) : (
                              <CheckCircle className="w-4 h-4 text-green-500 mx-auto" />
                            ))}
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
                Catatan Opname (opsional)
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Contoh: Opname bulanan Mei 2026"
                maxLength={300}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                {filledCount} dari {items.length} produk diisi
              </p>
              <button
                onClick={handleSubmit}
                disabled={submitting || filledCount === 0}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-5 py-2.5 rounded-xl font-medium text-sm transition-colors"
              >
                {submitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {submitting ? "Menyimpan..." : "Simpan Opname"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
