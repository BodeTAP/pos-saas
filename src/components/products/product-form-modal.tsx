"use client";

import { useState } from "react";
import { Category, Product } from "@prisma/client";
import { X, Loader2 } from "lucide-react";
import { ImageUpload } from "@/components/ui/image-upload";
import { VariantForm, type VariantFormValue } from "./variant-form";
import { toast } from "@/components/ui/toaster";

type ProductWithCategory = Product & { category: Category | null; hasVariants?: boolean };

interface ProductFormModalProps {
  product: ProductWithCategory | null;
  categories: Category[];
  onClose: () => void;
  onSaved: (product: ProductWithCategory) => void;
}

export function ProductFormModal({
  product,
  categories,
  onClose,
  onSaved,
}: ProductFormModalProps) {
  const isEdit = !!product;
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(product?.imageUrl || null);

  const [form, setForm] = useState({
    name: product?.name || "",
    sku: product?.sku || "",
    barcode: product?.barcode || "",
    description: product?.description || "",
    buyPrice: product?.buyPrice?.toString() || "0",
    sellPrice: product?.sellPrice?.toString() || "",
    stock: product?.stock?.toString() || "0",
    minStock: product?.minStock?.toString() || "5",
    unit: product?.unit || "pcs",
    categoryId: product?.categoryId || "",
    isActive: product?.isActive !== false,
  });

  const [variantData, setVariantData] = useState<VariantFormValue>({
    hasVariants: product?.hasVariants ?? false,
    variantTypes: [],
    skus: [],
  });

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      // Validate variant SKUs if hasVariants
      if (variantData.hasVariants) {
        if (variantData.skus.length === 0) {
          setError("Klik 'Generate Kombinasi' untuk membuat matriks SKU varian.");
          setIsLoading(false);
          return;
        }
        const invalidSku = variantData.skus.find((s) => s.isActive && s.price <= 0);
        if (invalidSku) {
          setError(`Harga varian "${invalidSku.label}" belum diisi.`);
          setIsLoading(false);
          return;
        }
      }

      const payload = {
        ...form,
        imageUrl: imageUrl || null,
        buyPrice: parseFloat(form.buyPrice) || 0,
        sellPrice: parseFloat(form.sellPrice),
        stock: parseInt(form.stock) || 0,
        minStock: parseInt(form.minStock) || 5,
        categoryId: form.categoryId || null,
        hasVariants: variantData.hasVariants,
      };

      const url = isEdit ? `/api/products/${product.id}` : "/api/products";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Gagal menyimpan produk.");
        return;
      }

      const savedProduct: ProductWithCategory = data.product;

      // Save variants if enabled
      if (variantData.hasVariants && variantData.skus.length > 0) {
        const variantPayload = {
          variantTypes: variantData.variantTypes.map((vt, i) => ({
            name: vt.name,
            position: i,
            options: vt.options.filter((o) => o.name.trim()).map((o) => ({ name: o.name.trim() })),
          })),
          skus: variantData.skus.map((sku) => ({
            optionIds: sku.optionIds,
            price: sku.price,
            buyPrice: sku.buyPrice,
            stock: sku.stock,
            minStock: sku.minStock,
            sku: sku.sku || null,
            imageUrl: sku.imageUrl || null,
            isActive: sku.isActive,
          })),
        };

        const variantRes = await fetch(`/api/products/${savedProduct.id}/variants`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(variantPayload),
        });

        if (!variantRes.ok) {
          const variantData = await variantRes.json();
          // Product was saved but variants failed — show warning but still close
          toast.warning(variantData.error || "Produk disimpan, tapi varian gagal disimpan.");
        } else {
          toast.success(isEdit ? "Produk dan varian berhasil diperbarui." : "Produk dan varian berhasil ditambahkan.");
        }
      } else {
        toast.success(isEdit ? "Produk berhasil diperbarui." : "Produk berhasil ditambahkan.");
      }

      onSaved(savedProduct);
    } catch {
      setError("Terjadi kesalahan. Silakan coba lagi.");
    } finally {
      setIsLoading(false);
    }
  }

  const hideStockPrice = variantData.hasVariants;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEdit ? "Edit Produk" : "Tambah Produk Baru"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Gambar Produk */}
          <div className="flex justify-center">
            <ImageUpload
              value={imageUrl}
              onChange={setImageUrl}
              folder="products"
              label="Foto Produk"
              size="md"
            />
          </div>

          {/* Nama */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nama Produk <span className="text-red-500">*</span>
            </label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              placeholder="Contoh: Kopi Arabika 250gr"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* SKU & Barcode */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                SKU
                <span className="text-xs text-gray-400 font-normal ml-1">
                  (opsional)
                </span>
              </label>
              <input
                name="sku"
                value={form.sku}
                onChange={handleChange}
                placeholder={isEdit ? "" : "Auto-generate jika kosong"}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {!isEdit && !form.sku && (
                <p className="text-xs text-gray-400 mt-1">
                  Kosongkan untuk generate otomatis dari nama produk
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Barcode</label>
              <input
                name="barcode"
                value={form.barcode}
                onChange={handleChange}
                placeholder="8991234567890"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Harga — hidden when hasVariants */}
          {!hideStockPrice && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Harga Beli (Rp)
                </label>
                <input
                  name="buyPrice"
                  type="number"
                  min={0}
                  value={form.buyPrice}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Harga Jual (Rp) <span className="text-red-500">*</span>
                </label>
                <input
                  name="sellPrice"
                  type="number"
                  min={0}
                  value={form.sellPrice}
                  onChange={handleChange}
                  required={!variantData.hasVariants}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {/* Harga dasar (fallback) when hasVariants */}
          {hideStockPrice && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Harga Dasar (Rp) <span className="text-red-500">*</span>
                <span className="text-xs text-gray-400 font-normal ml-1">
                  (digunakan sebagai fallback)
                </span>
              </label>
              <input
                name="sellPrice"
                type="number"
                min={0}
                value={form.sellPrice}
                onChange={handleChange}
                required
                placeholder="Harga terendah atau rata-rata"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Stok — hidden when hasVariants */}
          {!hideStockPrice && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stok</label>
                <input
                  name="stock"
                  type="number"
                  min={0}
                  value={form.stock}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Min. Stok</label>
                <input
                  name="minStock"
                  type="number"
                  min={0}
                  value={form.minStock}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Satuan</label>
                <input
                  name="unit"
                  value={form.unit}
                  onChange={handleChange}
                  placeholder="pcs"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {/* Satuan when hasVariants */}
          {hideStockPrice && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Satuan</label>
              <input
                name="unit"
                value={form.unit}
                onChange={handleChange}
                placeholder="pcs"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Kategori */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
            <select
              name="categoryId"
              value={form.categoryId}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Tanpa Kategori --</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              name="isActive"
              id="isActive"
              checked={form.isActive}
              onChange={handleChange}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <label htmlFor="isActive" className="text-sm text-gray-700">
              Produk aktif (tampil di kasir)
            </label>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-100 pt-2">
            <p className="text-sm font-semibold text-gray-700 mb-3">Varian Produk</p>
            <VariantForm
              productId={isEdit ? product.id : undefined}
              value={variantData}
              onChange={setVariantData}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                isEdit ? "Simpan Perubahan" : "Tambah Produk"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
