"use client";

import { useState } from "react";
import { X, Package, AlertTriangle, Check } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import Image from "next/image";

interface VariantOption {
  id: string;
  name: string;
}

interface VariantType {
  id: string;
  name: string;
  position: number;
  options: VariantOption[];
}

interface VariantSKU {
  id: string;
  sku: string | null;
  price: number;
  imageUrl: string | null;
  isActive: boolean;
  stock: number;
  minStock: number;
  label: string;
  optionIds: string[];
}

interface ProductForVariant {
  id: string;
  name: string;
  imageUrl: string | null;
  sellPrice: number;
  variantTypes: VariantType[];
  variantSKUs: VariantSKU[];
}

export type { ProductForVariant };

interface VariantPickerModalProps {
  product: ProductForVariant;
  onClose: () => void;
  onConfirm: (params: {
    productId: string;
    variantSkuId: string;
    variantLabel: string;
    price: number;
    stock: number;
    minStock: number;
    sku: string | null;
  }) => void;
}

/**
 * Modal pemilih varian produk di POS.
 * Kasir memilih satu opsi per tipe varian, sistem otomatis
 * menemukan SKU yang cocok dengan kombinasi tersebut.
 */
export function VariantPickerModal({
  product,
  onClose,
  onConfirm,
}: VariantPickerModalProps) {
  // State: selectedOptions[typeId] = optionId
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});

  const sortedTypes = [...product.variantTypes].sort((a, b) => a.position - b.position);

  // Cari SKU yang cocok dengan kombinasi opsi yang dipilih
  const matchedSKU = (() => {
    const selectedOptionIds = Object.values(selectedOptions);
    if (selectedOptionIds.length !== sortedTypes.length) return null;

    return product.variantSKUs.find((sku) => {
      // SKU cocok jika semua optionIds yang dipilih ada di sku.optionIds
      return selectedOptionIds.every((optId) => sku.optionIds.includes(optId));
    }) ?? null;
  })();

  const isComplete = Object.keys(selectedOptions).length === sortedTypes.length;
  const isOutOfStock = matchedSKU ? matchedSKU.stock === 0 : false;
  const isLowStock = matchedSKU ? matchedSKU.stock > 0 && matchedSKU.stock <= matchedSKU.minStock : false;

  function handleSelectOption(typeId: string, optionId: string) {
    setSelectedOptions((prev) => ({ ...prev, [typeId]: optionId }));
  }

  function handleConfirm() {
    if (!matchedSKU || isOutOfStock) return;
    onConfirm({
      productId: product.id,
      variantSkuId: matchedSKU.id,
      variantLabel: matchedSKU.label,
      price: matchedSKU.price,
      stock: matchedSKU.stock,
      minStock: matchedSKU.minStock,
      sku: matchedSKU.sku,
    });
  }

  // Cek apakah opsi tertentu menghasilkan SKU yang tersedia
  function getOptionAvailability(typeId: string, optionId: string): "available" | "out_of_stock" | "no_sku" {
    const testOptions = { ...selectedOptions, [typeId]: optionId };
    const testOptionIds = Object.values(testOptions);

    // Cari semua SKU yang mengandung opsi ini
    const matchingSKUs = product.variantSKUs.filter((sku) =>
      testOptionIds.every((id) => sku.optionIds.includes(id))
    );

    if (matchingSKUs.length === 0) return "no_sku";
    if (matchingSKUs.every((sku) => sku.stock === 0)) return "out_of_stock";
    return "available";
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-3 min-w-0">
            {/* Gambar produk atau SKU yang dipilih */}
            <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center">
              {(matchedSKU?.imageUrl || product.imageUrl) ? (
                <Image
                  src={matchedSKU?.imageUrl || product.imageUrl!}
                  alt={product.name}
                  width={48}
                  height={48}
                  className="object-cover w-full h-full"
                />
              ) : (
                <Package className="w-6 h-6 text-gray-300" />
              )}
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold text-gray-900 truncate">{product.name}</h2>
              <p className="text-sm text-blue-600 font-medium">
                {matchedSKU
                  ? formatCurrency(matchedSKU.price)
                  : `Mulai ${formatCurrency(Math.min(...product.variantSKUs.map((s) => s.price)))}`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Variant selectors */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {sortedTypes.map((variantType) => (
            <div key={variantType.id}>
              <p className="text-sm font-semibold text-gray-700 mb-2">
                {variantType.name}
                {!selectedOptions[variantType.id] && (
                  <span className="text-red-500 ml-1">*</span>
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                {variantType.options.map((option) => {
                  const isSelected = selectedOptions[variantType.id] === option.id;
                  const availability = getOptionAvailability(variantType.id, option.id);

                  return (
                    <button
                      key={option.id}
                      onClick={() => handleSelectOption(variantType.id, option.id)}
                      disabled={availability === "no_sku" || availability === "out_of_stock"}
                      className={cn(
                        "px-4 py-2 rounded-xl text-sm font-medium border-2 transition-all relative",
                        isSelected
                          ? "border-blue-600 bg-blue-600 text-white"
                          : availability === "out_of_stock"
                          ? "border-red-200 bg-red-50 text-red-400 line-through"
                          : availability === "no_sku"
                          ? "border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed"
                          : "border-gray-200 bg-white text-gray-700 hover:border-blue-400"
                      )}
                    >
                      {option.name}
                      {isSelected && (
                        <Check className="w-3 h-3 absolute -top-1 -right-1 bg-blue-600 rounded-full text-white" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Info SKU yang dipilih */}
          {matchedSKU && (
            <div
              className={cn(
                "rounded-xl p-3 border text-sm",
                isOutOfStock
                  ? "bg-red-50 border-red-200"
                  : isLowStock
                  ? "bg-orange-50 border-orange-200"
                  : "bg-green-50 border-green-200"
              )}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{matchedSKU.label}</p>
                  {matchedSKU.sku && (
                    <p className="text-xs text-gray-500 mt-0.5">SKU: {matchedSKU.sku}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-bold text-blue-600">{formatCurrency(matchedSKU.price)}</p>
                  <div className="flex items-center gap-1 justify-end mt-0.5">
                    {isOutOfStock ? (
                      <span className="text-xs text-red-600 font-medium">Stok Habis</span>
                    ) : isLowStock ? (
                      <>
                        <AlertTriangle className="w-3 h-3 text-orange-500" />
                        <span className="text-xs text-orange-600">Stok: {matchedSKU.stock}</span>
                      </>
                    ) : (
                      <span className="text-xs text-green-600">Stok: {matchedSKU.stock}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {isComplete && !matchedSKU && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm text-gray-500 text-center">
              Kombinasi varian ini tidak tersedia
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={handleConfirm}
            disabled={!matchedSKU || isOutOfStock}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
          >
            {!isComplete
              ? "Pilih semua varian"
              : isOutOfStock
              ? "Stok Habis"
              : `Tambah ke Keranjang — ${matchedSKU ? formatCurrency(matchedSKU.price) : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
