"use client";

import { Category, Product } from "@prisma/client";
import { formatCurrency } from "@/lib/utils";
import { Plus, Package } from "lucide-react";
import Image from "next/image";

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
      {products.map((product) => (
        <button
          key={product.id}
          onClick={() => onAddProduct(product)}
          className="bg-white rounded-xl border border-gray-200 p-3 text-left hover:border-blue-400 hover:shadow-md transition-all group active:scale-95"
        >
          {/* Product Image */}
          <div className="relative w-full aspect-square bg-gray-100 rounded-lg mb-2 flex items-center justify-center group-hover:bg-blue-50 transition-colors overflow-hidden">
            {product.imageUrl ? (
              <Image
                src={product.imageUrl}
                alt={product.name}
                fill
                sizes="(min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                className="object-cover"
              />
            ) : (
              <Package className="w-8 h-8 text-gray-300 group-hover:text-blue-300" />
            )}
          </div>

          <p className="text-xs font-medium text-gray-900 line-clamp-2 leading-tight mb-1">
            {product.name}
          </p>

          {product.sku && (
            <p className="text-xs text-gray-400 mb-1">{product.sku}</p>
          )}

          <div className="flex items-center justify-between mt-auto">
            <p className="text-sm font-bold text-blue-600">
              {formatCurrency(product.sellPrice)}
            </p>
            <span
              className={`text-xs px-1.5 py-0.5 rounded-full ${
                product.stock <= product.minStock
                  ? "bg-orange-100 text-orange-600"
                  : "bg-green-100 text-green-600"
              }`}
            >
              {product.stock}
            </span>
          </div>

          {/* Add button overlay */}
          <div className="mt-2 flex items-center justify-center w-full bg-blue-600 text-white text-xs py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
            <Plus className="w-3 h-3 mr-1" /> Tambah
          </div>
        </button>
      ))}
    </div>
  );
}
