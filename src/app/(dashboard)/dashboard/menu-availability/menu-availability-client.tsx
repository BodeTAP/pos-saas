"use client";

import { useState } from "react";
import { toast } from "@/components/ui/toaster";
import { formatCurrency } from "@/lib/utils";
import { CheckCircle, XCircle, Loader2, RefreshCw } from "lucide-react";
import Image from "next/image";

interface ProductItem {
  id: string;
  name: string;
  imageUrl: string | null;
  sellPrice: number;
  availableToday: boolean;
  categoryId: string | null;
  categoryName: string;
}

interface MenuAvailabilityClientProps {
  initialProducts: ProductItem[];
  categories: Array<{ id: string; name: string }>;
}

export function MenuAvailabilityClient({
  initialProducts,
  categories,
}: MenuAvailabilityClientProps) {
  const [products, setProducts] = useState<ProductItem[]>(initialProducts);
  const [updating, setUpdating] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filtered = selectedCategory
    ? products.filter((p) => p.categoryId === selectedCategory)
    : products;

  const availableCount = products.filter((p) => p.availableToday).length;
  const unavailableCount = products.length - availableCount;

  async function toggleAvailability(product: ProductItem) {
    setUpdating(product.id);
    const newValue = !product.availableToday;

    // Optimistic update
    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, availableToday: newValue } : p))
    );

    try {
      const res = await fetch(`/api/products/${product.id}/availability`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ availableToday: newValue }),
      });
      if (!res.ok) {
        // Rollback
        setProducts((prev) =>
          prev.map((p) => (p.id === product.id ? { ...p, availableToday: !newValue } : p))
        );
        const data = await res.json();
        toast.error(data.error || "Gagal update ketersediaan.");
      } else {
        toast.success(
          newValue
            ? `${product.name} tersedia hari ini.`
            : `${product.name} ditandai habis.`
        );
      }
    } catch {
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, availableToday: !newValue } : p))
      );
      toast.error("Terjadi kesalahan koneksi.");
    } finally {
      setUpdating(null);
    }
  }

  async function setAllAvailable(available: boolean) {
    const targets = products.filter((p) => p.availableToday !== available);
    if (targets.length === 0) return;

    // Optimistic
    setProducts((prev) => prev.map((p) => ({ ...p, availableToday: available })));

    try {
      await Promise.all(
        targets.map((p) =>
          fetch(`/api/products/${p.id}/availability`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ availableToday: available }),
          })
        )
      );
      toast.success(
        available
          ? "Semua menu ditandai tersedia."
          : "Semua menu ditandai habis."
      );
    } catch {
      // Rollback
      setProducts(initialProducts);
      toast.error("Gagal update semua menu.");
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Ketersediaan Menu</h1>
          <p className="text-gray-500 mt-0.5 text-sm">
            {availableCount} tersedia · {unavailableCount} habis hari ini
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setAllAvailable(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-green-300 text-green-700 hover:bg-green-50 rounded-xl transition-colors"
          >
            <CheckCircle className="w-4 h-4" />
            Semua Tersedia
          </button>
          <button
            onClick={() => setAllAvailable(false)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-red-300 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
          >
            <XCircle className="w-4 h-4" />
            Semua Habis
          </button>
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800">
        Toggle ketersediaan menu untuk hari ini. Menu yang ditandai <strong>habis</strong> tidak akan muncul di POS.
        Status ini tidak mempengaruhi stok produk.
      </div>

      {/* Category filter */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
            selectedCategory === null
              ? "bg-blue-600 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Semua
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              selectedCategory === cat.id
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Product grid */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <p className="text-gray-400 text-sm">Tidak ada produk ditemukan.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filtered.map((product) => (
            <div
              key={product.id}
              className={`bg-white rounded-xl border-2 overflow-hidden transition-all ${
                product.availableToday
                  ? "border-green-200"
                  : "border-red-200 opacity-70"
              }`}
            >
              {/* Image */}
              <div className="relative h-28 bg-gray-100">
                {product.imageUrl ? (
                  <Image
                    src={product.imageUrl}
                    alt={product.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 50vw, 25vw"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl">
                    🍽️
                  </div>
                )}
                {/* Status badge */}
                <div className={`absolute top-2 right-2 px-1.5 py-0.5 rounded-full text-xs font-medium ${
                  product.availableToday
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                }`}>
                  {product.availableToday ? "Tersedia" : "Habis"}
                </div>
              </div>

              {/* Info */}
              <div className="p-3">
                <p className="font-medium text-gray-900 text-sm truncate">{product.name}</p>
                <p className="text-xs text-gray-400 truncate">{product.categoryName}</p>
                <p className="text-sm font-semibold text-gray-700 mt-1">
                  {formatCurrency(product.sellPrice)}
                </p>

                {/* Toggle button */}
                <button
                  onClick={() => toggleAvailability(product)}
                  disabled={updating === product.id}
                  className={`w-full mt-2 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
                    product.availableToday
                      ? "bg-red-50 hover:bg-red-100 text-red-600 border border-red-200"
                      : "bg-green-50 hover:bg-green-100 text-green-700 border border-green-200"
                  } disabled:opacity-50`}
                >
                  {updating === product.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : product.availableToday ? (
                    <><XCircle className="w-3.5 h-3.5" /> Tandai Habis</>
                  ) : (
                    <><RefreshCw className="w-3.5 h-3.5" /> Tersedia Lagi</>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
