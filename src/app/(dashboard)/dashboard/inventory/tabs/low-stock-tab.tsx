"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, Package, RefreshCw, ExternalLink } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface LowStockItem {
  productId: string;
  productName: string;
  productSku: string | null;
  productUnit: string;
  categoryName: string | null;
  stock: number;
  minStock: number;
  status: "OUT_OF_STOCK" | "LOW_STOCK";
}

interface OutletInfo {
  id: string;
  name: string;
  isMain: boolean;
}

interface LowStockTabProps {
  initialItems: LowStockItem[];
  selectedOutlet: OutletInfo | null;
  outlets: OutletInfo[];
}

export function LowStockTab({ initialItems, selectedOutlet, outlets }: LowStockTabProps) {
  const [items, setItems] = useState<LowStockItem[]>(initialItems);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "OUT_OF_STOCK" | "LOW_STOCK">("all");

  async function fetchLowStock() {
    if (!selectedOutlet) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/inventory/low-stock?outletId=${selectedOutlet.id}`
      );
      if (res.ok) {
        const data = await res.json();
        setItems(data.items);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLowStock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOutlet?.id]);

  const filtered = items.filter((i) => filter === "all" || i.status === filter);
  const outOfStockCount = items.filter((i) => i.status === "OUT_OF_STOCK").length;
  const lowStockCount = items.filter((i) => i.status === "LOW_STOCK").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-gray-900">Peringatan Stok</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {selectedOutlet
              ? `Cabang: ${selectedOutlet.name}`
              : "Pilih cabang untuk melihat stok"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Filter buttons */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
            {(
              [
                { key: "all", label: `Semua (${items.length})` },
                { key: "OUT_OF_STOCK", label: `Habis (${outOfStockCount})` },
                { key: "LOW_STOCK", label: `Menipis (${lowStockCount})` },
              ] as const
            ).map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "px-3 py-1.5 font-medium transition-colors",
                  filter === f.key
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <button
            onClick={fetchLowStock}
            disabled={loading}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500 transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">
            {items.length === 0
              ? "Semua stok dalam kondisi aman ✓"
              : "Tidak ada item untuk filter ini"}
          </p>
          {items.length === 0 && (
            <p className="text-sm mt-1">Tidak ada produk di bawah batas minimum stok</p>
          )}
        </div>
      ) : (
        <>
          {/* Mobile: Cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((item) => (
              <div
                key={`${item.productId}`}
                className={cn(
                  "rounded-xl border p-4",
                  item.status === "OUT_OF_STOCK"
                    ? "border-red-200 bg-red-50"
                    : "border-orange-200 bg-orange-50"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{item.productName}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {item.productSku || "Tanpa SKU"} · {item.categoryName || "Tanpa Kategori"}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "text-xs px-2 py-1 rounded-full font-semibold flex-shrink-0",
                      item.status === "OUT_OF_STOCK"
                        ? "bg-red-100 text-red-700"
                        : "bg-orange-100 text-orange-700"
                    )}
                  >
                    {item.status === "OUT_OF_STOCK" ? "Habis" : "Menipis"}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/50">
                  <div className="flex items-center gap-1">
                    <AlertTriangle
                      className={cn(
                        "w-3.5 h-3.5",
                        item.status === "OUT_OF_STOCK" ? "text-red-500" : "text-orange-500"
                      )}
                    />
                    <span
                      className={cn(
                        "text-sm font-bold",
                        item.status === "OUT_OF_STOCK" ? "text-red-700" : "text-orange-700"
                      )}
                    >
                      {item.stock} {item.productUnit}
                    </span>
                    <span className="text-xs text-gray-500">/ min {item.minStock}</span>
                  </div>
                  <Link
                    href="/dashboard/products"
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                  >
                    Kelola <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: Table */}
          <div className="hidden md:block overflow-hidden rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Produk</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Kategori</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Stok Saat Ini</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Batas Min</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((item) => (
                  <tr
                    key={item.productId}
                    className={cn(
                      "transition-colors",
                      item.status === "OUT_OF_STOCK"
                        ? "bg-red-50 hover:bg-red-100"
                        : "hover:bg-orange-50"
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
                    <td className="px-4 py-3 text-right">
                      <span
                        className={cn(
                          "font-bold",
                          item.status === "OUT_OF_STOCK"
                            ? "text-red-700"
                            : "text-orange-700"
                        )}
                      >
                        {item.stock} {item.productUnit}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">
                      {item.minStock} {item.productUnit}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={cn(
                          "text-xs px-2 py-1 rounded-full font-medium",
                          item.status === "OUT_OF_STOCK"
                            ? "bg-red-100 text-red-700"
                            : "bg-orange-100 text-orange-700"
                        )}
                      >
                        {item.status === "OUT_OF_STOCK" ? "Stok Habis" : "Stok Menipis"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Link
                        href="/dashboard/products"
                        className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1"
                      >
                        Kelola <ExternalLink className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
