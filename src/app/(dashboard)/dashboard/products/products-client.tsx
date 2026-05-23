"use client";

import { useState } from "react";
import { Category, Product } from "@prisma/client";
import { formatCurrency } from "@/lib/utils";
import { toast } from "@/components/ui/toaster";
import {
  Plus, Search, Edit, Trash2, AlertTriangle, Package, Store,
} from "lucide-react";
import { ProductFormModal } from "@/components/products/product-form-modal";
import { Pagination } from "@/components/ui/pagination";

type ProductWithCategory = Product & { category: Category | null; hasVariants?: boolean };

interface OutletInfo {
  id: string;
  name: string;
  isMain: boolean;
}

interface ProductsClientProps {
  initialProducts: ProductWithCategory[];
  categories: Category[];
  outlet: OutletInfo | null;
  totalCount: number;
  currentPage: number;
  pageSize: number;
}

export function ProductsClient({
  initialProducts,
  categories,
  outlet,
  totalCount,
  currentPage,
  pageSize,
}: ProductsClientProps) {
  const [products, setProducts] = useState(initialProducts);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editProduct, setEditProduct] = useState<ProductWithCategory | null>(null);

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(search.toLowerCase()))
  );

  function handleSaved(product: ProductWithCategory) {
    setProducts((prev) => {
      const exists = prev.find((p) => p.id === product.id);
      if (exists) return prev.map((p) => (p.id === product.id ? product : p));
      return [product, ...prev];
    });
    setShowModal(false);
    setEditProduct(null);
  }

  async function handleDelete(id: string) {
    if (!confirm("Nonaktifkan produk ini?")) return;

    // Optimistic update — langsung tandai inactive
    const original = products.find((p) => p.id === id);
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isActive: false } : p))
    );

    const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Produk berhasil dinonaktifkan.");
    } else {
      // Rollback
      if (original) {
        setProducts((prev) => prev.map((p) => (p.id === id ? original : p)));
      }
      const data = await res.json();
      toast.error(data.error || "Gagal menonaktifkan produk.");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Produk</h1>
          <p className="text-gray-500 mt-1 text-sm">{products.length} produk terdaftar</p>
        </div>
        <button
          onClick={() => { setEditProduct(null); setShowModal(true); }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-medium transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Tambah Produk
        </button>
      </div>

      {/* Outlet Banner */}
      {outlet && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-3">
          <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Store className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-sm flex-1">
            <p className="font-medium text-blue-900">
              Stok yang ditampilkan: <span className="font-bold">{outlet.name}</span>
              {outlet.isMain && (
                <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
                  Utama
                </span>
              )}
            </p>
            <p className="text-xs text-blue-700 mt-0.5">
              Master produk (nama, SKU, harga, kategori) sama di semua cabang. Stok
              terpisah per cabang — gunakan switcher di atas untuk lihat cabang lain.
            </p>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari nama atau SKU produk..."
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Mobile: Card list */}
      <div className="md:hidden space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
            <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>Belum ada produk</p>
          </div>
        ) : (
          filtered.map((product) => (
            <div key={product.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900">{product.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {product.sku || "Tanpa SKU"} · {product.category?.name || "Tanpa Kategori"}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => { setEditProduct(product); setShowModal(true); }}
                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(product.id)}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                <div className="flex items-center gap-1.5">
                  {product.hasVariants ? (
                    <span className="text-xs text-purple-600 font-medium">Produk varian</span>
                  ) : (
                    <>
                      {product.stock <= product.minStock && product.stock > 0 && (
                        <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
                      )}
                      <span
                        className={`text-sm font-semibold ${
                          product.stock === 0
                            ? "text-red-600"
                            : product.stock <= product.minStock
                            ? "text-orange-600"
                            : "text-gray-700"
                        }`}
                      >
                        {product.stock} {product.unit}
                      </span>
                      <span className="text-xs text-gray-400">stok</span>
                    </>
                  )}
                </div>
                <span className="font-bold text-gray-900">{formatCurrency(product.sellPrice)}</span>
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    product.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {product.isActive ? "Aktif" : "Nonaktif"}
                </span>
                {product.hasVariants && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-purple-100 text-purple-700">
                    Varian
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop: Table */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Produk</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">SKU</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Kategori</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Harga Jual</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Stok</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400">
                    <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p>Belum ada produk</p>
                  </td>
                </tr>
              ) : (
                filtered.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{product.name}</p>
                      {product.barcode && (
                        <p className="text-xs text-gray-400">{product.barcode}</p>
                      )}
                      {product.hasVariants && (
                        <span className="inline-block mt-0.5 text-xs px-1.5 py-0.5 rounded-full font-medium bg-purple-100 text-purple-700">
                          Varian
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{product.sku || "-"}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {product.category?.name || "-"}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {formatCurrency(product.sellPrice)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {product.hasVariants ? (
                        <span className="text-xs text-purple-600 font-medium">Per varian</span>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          {product.stock <= product.minStock && product.stock > 0 && (
                            <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
                          )}
                          <span
                            className={
                              product.stock === 0
                                ? "text-red-600 font-semibold"
                                : product.stock <= product.minStock
                                ? "text-orange-600 font-semibold"
                                : "text-gray-900"
                            }
                          >
                            {product.stock} {product.unit}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          product.isActive
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {product.isActive ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => { setEditProduct(product); setShowModal(true); }}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(product.id)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <ProductFormModal
          product={editProduct}
          categories={categories}
          onClose={() => { setShowModal(false); setEditProduct(null); }}
          onSaved={handleSaved}
        />
      )}

      {/* Pagination */}
      {totalCount > pageSize && (
        <Pagination
          currentPage={currentPage}
          totalCount={totalCount}
          pageSize={pageSize}
          basePath="/dashboard/products"
        />
      )}
    </div>
  );
}
