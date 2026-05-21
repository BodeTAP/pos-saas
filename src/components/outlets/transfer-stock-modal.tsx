"use client";

import { useState, useEffect } from "react";
import { X, Loader2, ArrowRight } from "lucide-react";
import { toast } from "@/components/ui/toaster";

interface OutletOption {
  id: string;
  name: string;
}

interface ProductOption {
  id: string;
  name: string;
  sku: string | null;
  stock: number; // stok di fromOutlet
}

interface TransferStockModalProps {
  outlets: OutletOption[];
  defaultFromOutletId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function TransferStockModal({
  outlets,
  defaultFromOutletId,
  onClose,
  onSuccess,
}: TransferStockModalProps) {
  const [fromOutletId, setFromOutletId] = useState(defaultFromOutletId || outlets[0]?.id || "");
  const [toOutletId, setToOutletId] = useState(
    outlets.find((outlet) => outlet.id !== (defaultFromOutletId || outlets[0]?.id))?.id || ""
  );
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(!!fromOutletId);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Load produk dengan stok di fromOutlet
  useEffect(() => {
    if (!fromOutletId) return;
    let cancelled = false;

    fetch(`/api/products?outletId=${fromOutletId}&limit=200`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setProducts(
          (data.products || [])
            .filter((p: ProductOption) => p.stock > 0)
            .map((p: { id: string; name: string; sku: string | null; stock: number }) => ({
              id: p.id,
              name: p.name,
              sku: p.sku,
              stock: p.stock,
            }))
        );
      })
      .catch(() => {
        if (!cancelled) setProducts([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingProducts(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fromOutletId]);

  const selectedProduct = products.find((p) => p.id === productId);
  const maxQty = selectedProduct?.stock || 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const qty = parseInt(quantity);
    if (!productId) { setError("Pilih produk terlebih dahulu."); return; }
    if (!toOutletId) { setError("Pilih cabang tujuan."); return; }
    if (isNaN(qty) || qty <= 0) { setError("Jumlah harus lebih dari 0."); return; }
    if (qty > maxQty) { setError(`Stok tidak cukup (tersedia: ${maxQty}).`); return; }

    setIsLoading(true);
    try {
      const res = await fetch("/api/outlets/transfer-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromOutletId, toOutletId, productId, quantity: qty, note }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal melakukan transfer.");
        return;
      }
      toast.success(data.message);
      onSuccess();
    } catch {
      setError("Terjadi kesalahan koneksi.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleFromOutletChange(nextFromOutletId: string) {
    const nextDestination = outlets.find((outlet) => outlet.id !== nextFromOutletId);
    setFromOutletId(nextFromOutletId);
    setToOutletId(nextDestination?.id || "");
    setProductId("");
    setQuantity("");
    setProducts([]);
    setIsLoadingProducts(!!nextFromOutletId);
  }

  const toOutlets = outlets.filter((o) => o.id !== fromOutletId);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Transfer Stok Antar Cabang</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Asal → Tujuan */}
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Dari Cabang</label>
              <select
                value={fromOutletId}
                onChange={(e) => handleFromOutletChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                {outlets.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-5" />
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Ke Cabang</label>
              <select
                value={toOutletId}
                onChange={(e) => setToOutletId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                {toOutlets.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Produk */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Produk <span className="text-red-500">*</span>
            </label>
            {isLoadingProducts ? (
              <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Memuat produk...
              </div>
            ) : (
              <select
                value={productId}
                onChange={(e) => { setProductId(e.target.value); setQuantity(""); }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">-- Pilih Produk --</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.sku ? `(${p.sku})` : ""} — Stok: {p.stock}
                  </option>
                ))}
              </select>
            )}
            {products.length === 0 && !isLoadingProducts && (
              <p className="text-xs text-gray-400 mt-1">
                Tidak ada produk dengan stok di cabang ini.
              </p>
            )}
          </div>

          {/* Jumlah */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Jumlah Transfer <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={maxQty}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              {maxQty > 0 && (
                <button
                  type="button"
                  onClick={() => setQuantity(maxQty.toString())}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  Max ({maxQty})
                </button>
              )}
            </div>
          </div>

          {/* Catatan */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Catatan</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Opsional"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isLoading || !productId || !quantity}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2.5 rounded-xl flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Memproses...</>
              ) : (
                "Transfer Stok"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
