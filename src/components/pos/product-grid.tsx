"use client";

import { Category, Product } from "@prisma/client";
import { formatCurrency } from "@/lib/utils";
import { Plus, Package, AlertTriangle } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";

type ProductWithCategory = Product & { category: Category | null };

interface ProductGridProps {
  products: ProductWithCategory[];
  onAddProduct: (product: ProductWithCategory) => void;
}

export function ProductGrid({ products, onAddProduct }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-gray-400">
        <Package className="w-12 h-12 mb-2 opacity-30" />
        <p className="text-sm">Produk tidak ditemukan</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      {products.map((product) => {
        const isOutOfStock = product.stock === 0;
        const isLowStock = !isOutOfStock && product.stock <= product.minStock;

        return (
          <button
            key={product.id}
            onClick={() => !isOutOfStock && onAddProduct(product)}
            disabled={isOutOfStock}
            className={cn(
              "bg-white rounded-xl border p-3 text-left transition-all group active:scale-95 relative",
              isOutOfStock
                ? "border-red-200 bg-red-50 opacity-70 cursor-not-allowed"
                : isLowStock
                ? "border-orange-200 hover:border-orange-400 hover:shadow-md"
                : "border-gray-200 hover:border-blue-400 hover:shadow-md"
            )}
          >
            {/* Out of stock overlay badge */}
            {isOutOfStock && (
              <div className="absolute top-2 left-2 z-10 bg-red-600 text-white text-xs px-1.5 py-0.5 rounded-full font-semibold">
                Habis
              </div>
            )}

            {/* Low stock badge */}
            {isLowStock && (
              <div className="absolute top-2 left-2 z-10 bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-0.5">
                <AlertTriangle className="w-2.5 h-2.5" />
                Menipis
              </div>
            )}

            {/* Product Image */}
            <div
              className={cn(
                "relative w-full aspect-square rounded-lg mb-2 flex items-center justify-center transition-colors overflow-hidden",
                isOutOfStock
                  ? "bg-red-100"
                  : isLowStock
                  ? "bg-orange-50 group-hover:bg-orange-100"
                  : "bg-gray-100 group-hover:bg-blue-50"
              )}
            >
              {product.imageUrl ? (
                <Image
                  src={product.imageUrl}
                  alt={product.name}
                  fill
                  sizes="(min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                  className={cn("object-cover", isOutOfStock && "grayscale opacity-60")}
                />
              ) : (
                <Package
                  className={cn(
                    "w-8 h-8",
                    isOutOfStock
                      ? "text-red-300"
                      : isLowStock
                      ? "text-orange-300 group-hover:text-orange-400"
                      : "text-gray-300 group-hover:text-blue-300"
                  )}
                />
              )}
            </div>

            <p className="text-xs font-medium text-gray-900 line-clamp-2 leading-tight mb-1">
              {product.name}
            </p>

            {product.sku && (
              <p className="text-xs text-gray-400 mb-1">{product.sku}</p>
            )}

            <div className="flex items-center justify-between mt-auto">
              <p
                className={cn(
                  "text-sm font-bold",
                  isOutOfStock ? "text-gray-400" : "text-blue-600"
                )}
              >
                {formatCurrency(product.sellPrice)}
              </p>
              <span
                className={cn(
                  "text-xs px-1.5 py-0.5 rounded-full font-medium",
                  isOutOfStock
                    ? "bg-red-100 text-red-700"
                    : isLowStock
                    ? "bg-orange-100 text-orange-700"
                    : "bg-green-100 text-green-700"
                )}
              >
                {product.stock}
              </span>
            </div>

            {/* Add button overlay — hanya tampil kalau ada stok */}
            {!isOutOfStock && (
              <div
                className={cn(
                  "mt-2 flex items-center justify-center w-full text-white text-xs py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity",
                  isLowStock ? "bg-orange-500" : "bg-blue-600"
                )}
              >
                <Plus className="w-3 h-3 mr-1" /> Tambah
              </div>
            )}

            {/* Out of stock message */}
            {isOutOfStock && (
              <div className="mt-2 flex items-center justify-center w-full bg-red-100 text-red-600 text-xs py-1.5 rounded-lg">
                Stok Habis
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
