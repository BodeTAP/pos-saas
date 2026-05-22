"use client";

import { useState, useEffect } from "react";
import { X, Plus, Trash2, Loader2, Search } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

interface OutletInfo { id: string; name: string; isMain: boolean }

interface POSummary {
  id: string;
  poNumber: string;
  status: "DRAFT" | "ORDERED" | "PARTIAL" | "RECEIVED" | "CANCELLED";
  supplierName: string | null;
  totalCost: number;
  totalItems: number;
  itemCount: number;
  totalQty: number;
  receivedQty: number;
  expectedDate: Date | null;
  receivedAt: Date | null;
  createdAt: Date;
  outlet: { name: string };
}

interface ProductOption {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  buyPrice: number;
}

interface POItem {
  productId: string;
  productName: string;
  productSku: string | null;
  unit: string;
  quantity: number;
  buyPrice: number;
}

interface CreatePOModalProps {
  outlets: OutletInfo[];
  onClose: () => void;
  onCreated: (order: POSummary) => void;
}

export function CreatePOModal({ outlets, onClose, onCreated }: CreatePOModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [showProductSearch, setShowProductSearch] = useState(false);

  const [form, setForm] = useState({
    outletId: outlets[0]?.id || "",
    supplierName: "",
    supplierPhone: "",
    note: "",
    expectedDate: "",
  });

  const [items, setItems] = useState<POItem[]>([]);

  // Fetch produk saat search berubah
  useEffect(() => {
    if (!productSearch.trim()) { setProducts([]); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/products?search=${encodeURIComponent(productSearch)}&limit=10&isActive=true`);
        if (res.ok) {
          const data = await res.json();
          setProducts(data.products || []);
        }
      } catch { /* ignore */ }
    }, 300);
    return () => clearTimeout(timer);
  }, [productSearch]);

  function addProduct(product: ProductOption) {
    const exists = items.find((i) => i.productId === product.id);
    if (exists) {
      setItems((prev) => prev.map((i) =>
        i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i
      ));
    } else {
      setItems((prev) => [...prev, {
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        unit: product.unit,
        quantity: 1,
        buyPrice: product.buyPrice || 0,
      }]);
    }
    setProductSearch("");
    setProducts([]);
    setShowProductSearch(false);
  }

  function removeItem(productId: string) {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }

  function updateItem(productId: string, field: "quantity" | "buyPrice", value: number) {
    setItems((prev) => prev.map((i) =>
      i.productId === productId ? { ...i, [field]: value } : i
    ));
  }

  const totalCost = items.reduce((sum, i) => sum + i.quantity * i.buyPrice, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (items.length === 0) { toast.error("Tambahkan minimal 1 produk."); return; }

    setIsLoading(true);
    try {
      const res = await fetch("/api/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outletId: form.outletId,
          supplierName: form.supplierName || null,
          supplierPhone: form.supplierPhone || null,
          note: form.note || null,
          expectedDate: form.expectedDate || null,
          items: items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            buyPrice: i.buyPrice,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Gagal membuat PO."); return; }

      toast.success(`PO ${data.order.poNumber} berhasil dibuat.`);
      onCreated(data.order);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">Buat Purchase Order</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-5 space-y-4">
            {/* Cabang & Supplier */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cabang Tujuan <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.outletId}
                  onChange={(e) => setForm((p) => ({ ...p, outletId: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {outlets.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} {o.isMain ? "(Utama)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nama Supplier
                </label>
                <input
                  value={form.supplierName}
                  onChange={(e) => setForm((p) => ({ ...p, supplierName: e.target.value }))}
                  placeholder="Contoh: PT Sumber Makmur"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  No. Telepon Supplier
                </label>
                <input
                  value={form.supplierPhone}
                  onChange={(e) => setForm((p) => ({ ...p, supplierPhone: e.target.value }))}
                  placeholder="08xxxxxxxxxx"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estimasi Tiba
                </label>
                <input
                  type="date"
                  value={form.expectedDate}
                  onChange={(e) => setForm((p) => ({ ...p, expectedDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Catatan</label>
              <input
                value={form.note}
                onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
                placeholder="Catatan tambahan..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Produk */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">
                  Produk <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowProductSearch(true)}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Tambah Produk
                </button>
              </div>

              {/* Product search */}
              {showProductSearch && (
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    autoFocus
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Cari nama atau SKU produk..."
                    className="w-full pl-9 pr-4 py-2 border border-blue-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {products.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto mt-1">
                      {products.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => addProduct(p)}
                          className="w-full text-left px-3 py-2.5 hover:bg-gray-50 text-sm border-b border-gray-50 last:border-0"
                        >
                          <p className="font-medium text-gray-900">{p.name}</p>
                          <p className="text-xs text-gray-500">
                            {p.sku || "Tanpa SKU"} · {formatCurrency(p.buyPrice)}/unit
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => { setShowProductSearch(false); setProductSearch(""); setProducts([]); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Items table */}
              {items.length === 0 ? (
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center text-gray-400 text-sm">
                  Belum ada produk. Klik &quot;Tambah Produk&quot; untuk mencari.
                </div>
              ) : (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left px-3 py-2 font-medium text-gray-600">Produk</th>
                        <th className="text-right px-3 py-2 font-medium text-gray-600 w-24">Qty</th>
                        <th className="text-right px-3 py-2 font-medium text-gray-600 w-32">Harga Beli</th>
                        <th className="text-right px-3 py-2 font-medium text-gray-600 w-28">Subtotal</th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {items.map((item) => (
                        <tr key={item.productId}>
                          <td className="px-3 py-2">
                            <p className="font-medium text-gray-900">{item.productName}</p>
                            {item.productSku && (
                              <p className="text-xs text-gray-400">{item.productSku}</p>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={(e) => updateItem(item.productId, "quantity", parseInt(e.target.value) || 1)}
                              className="w-20 px-2 py-1 border border-gray-200 rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              min={0}
                              value={item.buyPrice}
                              onChange={(e) => updateItem(item.productId, "buyPrice", parseFloat(e.target.value) || 0)}
                              className="w-28 px-2 py-1 border border-gray-200 rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-3 py-2 text-right font-medium text-gray-900">
                            {formatCurrency(item.quantity * item.buyPrice)}
                          </td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => removeItem(item.productId)}
                              className="text-red-400 hover:text-red-600 p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 border-t border-gray-200">
                        <td colSpan={3} className="px-3 py-2 text-right font-semibold text-gray-700">
                          Total
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-gray-900">
                          {formatCurrency(totalCost)}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 p-5 border-t border-gray-200 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isLoading || items.length === 0}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...</>
              ) : (
                "Buat PO"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
