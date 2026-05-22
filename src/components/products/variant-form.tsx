"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, RefreshCw, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { ImageUpload } from "@/components/ui/image-upload";
import { formatCurrency } from "@/lib/utils";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export interface VariantTypeInput {
  name: string;
  position: number;
  options: { name: string }[];
}

export interface VariantSKUInput {
  /** Format "typeIdx-optionIdx", e.g. "0-0", "1-2" */
  optionIds: string[];
  /** Label auto-generated, e.g. "S / Merah" */
  label: string;
  price: number;
  buyPrice: number;
  stock: number;
  minStock: number;
  sku: string | null;
  imageUrl: string | null;
  isActive: boolean;
}

export interface VariantFormValue {
  hasVariants: boolean;
  variantTypes: VariantTypeInput[];
  skus: VariantSKUInput[];
}

interface VariantFormProps {
  productId?: string; // undefined = new product (no load from API)
  value: VariantFormValue;
  onChange: (value: VariantFormValue) => void;
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

/** Generate all SKU combinations from variant types */
function generateCombinations(types: VariantTypeInput[]): VariantSKUInput[] {
  const validTypes = types.filter((t) => t.name.trim() && t.options.some((o) => o.name.trim()));
  if (validTypes.length === 0) return [];

  // Cartesian product
  const optionSets = validTypes.map((t, typeIdx) =>
    t.options
      .map((o, optIdx) => ({ label: o.name.trim(), key: `${typeIdx}-${optIdx}` }))
      .filter((o) => o.label)
  );

  function cartesian(sets: typeof optionSets): Array<Array<{ label: string; key: string }>> {
    if (sets.length === 0) return [[]];
    const [first, ...rest] = sets;
    const restCombinations = cartesian(rest);
    return first.flatMap((item) => restCombinations.map((combo) => [item, ...combo]));
  }

  const combinations = cartesian(optionSets);

  return combinations.map((combo) => ({
    optionIds: combo.map((c) => c.key),
    label: combo.map((c) => c.label).join(" / "),
    price: 0,
    buyPrice: 0,
    stock: 0,
    minStock: 5,
    sku: null,
    imageUrl: null,
    isActive: true,
  }));
}

// ─────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────

export function VariantForm({ productId, value, onChange }: VariantFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [expandedSku, setExpandedSku] = useState<number | null>(null);

  // Load existing variants when editing
  useEffect(() => {
    if (!productId || !value.hasVariants) return;
    // Only load once when first enabling variants for an existing product
    // (the parent controls hasVariants toggle, so we load when productId is set and hasVariants is true)
    loadVariants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  async function loadVariants() {
    if (!productId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/products/${productId}/variants`);
      if (!res.ok) return;
      const data = await res.json() as {
        variantTypes: Array<{
          id: string;
          name: string;
          position: number;
          options: Array<{ id: string; name: string }>;
        }>;
        skus: Array<{
          id: string;
          sku: string | null;
          imageUrl: string | null;
          price: number;
          buyPrice: number;
          isActive: boolean;
          stock: number;
          minStock: number;
          label: string;
          optionIds: string[];
        }>;
      };

      if (!data.variantTypes || data.variantTypes.length === 0) return;

      // Convert API response to form format
      const variantTypes: VariantTypeInput[] = data.variantTypes.map((vt, typeIdx) => ({
        name: vt.name,
        position: typeIdx,
        options: vt.options.map((o) => ({ name: o.name })),
      }));

      // Build option ID map: real DB optionId → "typeIdx-optionIdx"
      const optionIdMap = new Map<string, string>();
      data.variantTypes.forEach((vt, typeIdx) => {
        vt.options.forEach((opt, optIdx) => {
          optionIdMap.set(opt.id, `${typeIdx}-${optIdx}`);
        });
      });

      const skus: VariantSKUInput[] = data.skus.map((sku) => ({
        optionIds: sku.optionIds.map((id) => optionIdMap.get(id) ?? id),
        label: sku.label,
        price: sku.price,
        buyPrice: sku.buyPrice,
        stock: sku.stock,
        minStock: sku.minStock,
        sku: sku.sku,
        imageUrl: sku.imageUrl,
        isActive: sku.isActive,
      }));

      onChange({ ...value, variantTypes, skus });
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }

  // ── Variant Types ──────────────────────────

  function addVariantType() {
    const newTypes = [
      ...value.variantTypes,
      { name: "", position: value.variantTypes.length, options: [{ name: "" }] },
    ];
    onChange({ ...value, variantTypes: newTypes });
  }

  function removeVariantType(typeIdx: number) {
    const newTypes = value.variantTypes
      .filter((_, i) => i !== typeIdx)
      .map((t, i) => ({ ...t, position: i }));
    onChange({ ...value, variantTypes: newTypes, skus: [] });
  }

  function updateTypeName(typeIdx: number, name: string) {
    const newTypes = value.variantTypes.map((t, i) =>
      i === typeIdx ? { ...t, name } : t
    );
    onChange({ ...value, variantTypes: newTypes });
  }

  // ── Options ────────────────────────────────

  function addOption(typeIdx: number) {
    const newTypes = value.variantTypes.map((t, i) =>
      i === typeIdx ? { ...t, options: [...t.options, { name: "" }] } : t
    );
    onChange({ ...value, variantTypes: newTypes });
  }

  function removeOption(typeIdx: number, optIdx: number) {
    const newTypes = value.variantTypes.map((t, i) =>
      i === typeIdx
        ? { ...t, options: t.options.filter((_, j) => j !== optIdx) }
        : t
    );
    onChange({ ...value, variantTypes: newTypes, skus: [] });
  }

  function updateOptionName(typeIdx: number, optIdx: number, name: string) {
    const newTypes = value.variantTypes.map((t, i) =>
      i === typeIdx
        ? {
            ...t,
            options: t.options.map((o, j) => (j === optIdx ? { name } : o)),
          }
        : t
    );
    onChange({ ...value, variantTypes: newTypes });
  }

  // ── SKU Generation ─────────────────────────

  function handleGenerate() {
    const newSkus = generateCombinations(value.variantTypes);
    // Preserve existing SKU data where label matches
    const merged = newSkus.map((newSku) => {
      const existing = value.skus.find((s) => s.label === newSku.label);
      return existing ? { ...newSku, ...existing, label: newSku.label, optionIds: newSku.optionIds } : newSku;
    });
    onChange({ ...value, skus: merged });
    setExpandedSku(null);
  }

  // ── SKU Updates ────────────────────────────

  const updateSku = useCallback(
    (skuIdx: number, updates: Partial<VariantSKUInput>) => {
      const newSkus = value.skus.map((s, i) =>
        i === skuIdx ? { ...s, ...updates } : s
      );
      onChange({ ...value, skus: newSkus });
    },
    [value, onChange]
  );

  // ── Toggle ─────────────────────────────────

  function handleToggle(enabled: boolean) {
    if (enabled) {
      const newValue: VariantFormValue = {
        hasVariants: true,
        variantTypes:
          value.variantTypes.length > 0
            ? value.variantTypes
            : [{ name: "", position: 0, options: [{ name: "" }] }],
        skus: value.skus,
      };
      onChange(newValue);
    } else {
      onChange({ hasVariants: false, variantTypes: value.variantTypes, skus: value.skus });
    }
  }

  const canGenerate =
    value.variantTypes.length > 0 &&
    value.variantTypes.every(
      (t) => t.name.trim() && t.options.some((o) => o.name.trim())
    );

  return (
    <div className="space-y-4">
      {/* Toggle */}
      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200">
        <div>
          <p className="text-sm font-medium text-gray-800">Produk ini memiliki varian</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Contoh: ukuran, warna, rasa, dll.
          </p>
        </div>
        <button
          type="button"
          onClick={() => handleToggle(!value.hasVariants)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
            value.hasVariants ? "bg-blue-600" : "bg-gray-300"
          }`}
          role="switch"
          aria-checked={value.hasVariants}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              value.hasVariants ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {value.hasVariants && (
        <>
          {/* Warning */}
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-500" />
            <span>
              Mengaktifkan varian akan menggantikan harga dan stok produk utama. Harga dan stok
              dikelola per kombinasi varian.
            </span>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-gray-400 text-sm">
              <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              Memuat data varian...
            </div>
          ) : (
            <>
              {/* Variant Types */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-700">Tipe Varian</p>
                  <button
                    type="button"
                    onClick={addVariantType}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Tambah Tipe
                  </button>
                </div>

                {value.variantTypes.map((vt, typeIdx) => (
                  <div
                    key={typeIdx}
                    className="border border-gray-200 rounded-xl p-3 space-y-2 bg-white"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={vt.name}
                        onChange={(e) => updateTypeName(typeIdx, e.target.value)}
                        placeholder={`Tipe ${typeIdx + 1} (contoh: Ukuran)`}
                        className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {value.variantTypes.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeVariantType(typeIdx)}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Options */}
                    <div className="space-y-1.5 pl-2">
                      <p className="text-xs text-gray-500 font-medium">Opsi:</p>
                      {vt.options.map((opt, optIdx) => (
                        <div key={optIdx} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={opt.name}
                            onChange={(e) => updateOptionName(typeIdx, optIdx, e.target.value)}
                            placeholder={`Opsi ${optIdx + 1} (contoh: S)`}
                            className="flex-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          {vt.options.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeOption(typeIdx, optIdx)}
                              className="p-1 text-red-400 hover:text-red-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addOption(typeIdx)}
                        className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 mt-1"
                      >
                        <Plus className="w-3 h-3" />
                        Tambah opsi
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Generate Button */}
              <button
                type="button"
                onClick={handleGenerate}
                disabled={!canGenerate}
                className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-blue-300 text-blue-600 rounded-xl text-sm font-medium hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Generate Kombinasi
              </button>

              {/* SKU Matrix */}
              {value.skus.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-gray-700">
                    Matriks SKU ({value.skus.length} kombinasi)
                  </p>
                  <div className="space-y-2">
                    {value.skus.map((sku, skuIdx) => (
                      <div
                        key={skuIdx}
                        className={`border rounded-xl overflow-hidden ${
                          sku.isActive ? "border-gray-200" : "border-gray-100 opacity-60"
                        }`}
                      >
                        {/* SKU Row Header */}
                        <div
                          className="flex items-center justify-between px-3 py-2.5 bg-gray-50 cursor-pointer"
                          onClick={() =>
                            setExpandedSku(expandedSku === skuIdx ? null : skuIdx)
                          }
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm font-medium text-gray-800 truncate">
                              {sku.label}
                            </span>
                            {sku.price > 0 && (
                              <span className="text-xs text-blue-600 font-medium flex-shrink-0">
                                {formatCurrency(sku.price)}
                              </span>
                            )}
                            {sku.price === 0 && (
                              <span className="text-xs text-red-500 flex-shrink-0">
                                Harga belum diisi
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {/* Active toggle */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateSku(skuIdx, { isActive: !sku.isActive });
                              }}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                sku.isActive ? "bg-blue-600" : "bg-gray-300"
                              }`}
                            >
                              <span
                                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                                  sku.isActive ? "translate-x-4.5" : "translate-x-0.5"
                                }`}
                              />
                            </button>
                            {expandedSku === skuIdx ? (
                              <ChevronUp className="w-4 h-4 text-gray-400" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-gray-400" />
                            )}
                          </div>
                        </div>

                        {/* SKU Detail (expanded) */}
                        {expandedSku === skuIdx && (
                          <div className="p-3 space-y-3 bg-white border-t border-gray-100">
                            {/* Price row */}
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                  Harga Jual (Rp) <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="number"
                                  min={0}
                                  value={sku.price || ""}
                                  onChange={(e) =>
                                    updateSku(skuIdx, { price: parseFloat(e.target.value) || 0 })
                                  }
                                  placeholder="0"
                                  className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                  Harga Beli (Rp)
                                </label>
                                <input
                                  type="number"
                                  min={0}
                                  value={sku.buyPrice || ""}
                                  onChange={(e) =>
                                    updateSku(skuIdx, { buyPrice: parseFloat(e.target.value) || 0 })
                                  }
                                  placeholder="0"
                                  className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                            </div>

                            {/* Stock row */}
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                  Stok
                                </label>
                                <input
                                  type="number"
                                  min={0}
                                  value={sku.stock}
                                  onChange={(e) =>
                                    updateSku(skuIdx, { stock: parseInt(e.target.value) || 0 })
                                  }
                                  className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                  Min. Stok
                                </label>
                                <input
                                  type="number"
                                  min={0}
                                  value={sku.minStock}
                                  onChange={(e) =>
                                    updateSku(skuIdx, { minStock: parseInt(e.target.value) || 0 })
                                  }
                                  className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                            </div>

                            {/* SKU code */}
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                Kode SKU{" "}
                                <span className="text-gray-400 font-normal">(opsional)</span>
                              </label>
                              <input
                                type="text"
                                value={sku.sku || ""}
                                onChange={(e) =>
                                  updateSku(skuIdx, { sku: e.target.value || null })
                                }
                                placeholder="Auto-generate jika kosong"
                                className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>

                            {/* Image */}
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                Gambar Varian{" "}
                                <span className="text-gray-400 font-normal">(opsional)</span>
                              </label>
                              <ImageUpload
                                value={sku.imageUrl}
                                onChange={(url) => updateSku(skuIdx, { imageUrl: url })}
                                folder="variants"
                                label="Upload Gambar"
                                size="sm"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {value.skus.length === 0 && canGenerate && (
                <p className="text-xs text-center text-gray-400 py-2">
                  Klik &quot;Generate Kombinasi&quot; untuk membuat matriks SKU
                </p>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
