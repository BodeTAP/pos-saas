"use client";

import { useState } from "react";
import { X, Loader2, Plus, Trash2 } from "lucide-react";
import type { PlanInfo } from "@/lib/plans";

interface PlanFormModalProps {
  plan: PlanInfo;
  onClose: () => void;
  onSaved: (plan: PlanInfo) => void;
}

export function PlanFormModal({ plan, onClose, onSaved }: PlanFormModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: plan.name,
    description: plan.description || "",
    monthlyPrice: plan.monthlyPrice.toString(),
    yearlyPrice: plan.yearlyPrice.toString(),
    yearlyDiscountPct: plan.yearlyDiscountPct.toString(),
    maxProducts: plan.maxProducts.toString(),
    maxCashiers: plan.maxCashiers.toString(),
    maxOutlets: plan.maxOutlets.toString(),
    features: [...plan.features],
    isActive: plan.isActive,
  });

  const [newFeature, setNewFeature] = useState("");

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  }

  function addFeature() {
    if (!newFeature.trim()) return;
    setForm((prev) => ({ ...prev, features: [...prev.features, newFeature.trim()] }));
    setNewFeature("");
  }

  function removeFeature(idx: number) {
    setForm((prev) => ({
      ...prev,
      features: prev.features.filter((_, i) => i !== idx),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/super-admin/plans/${plan.tier}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          monthlyPrice: parseFloat(form.monthlyPrice) || 0,
          yearlyPrice: parseFloat(form.yearlyPrice) || 0,
          yearlyDiscountPct: parseFloat(form.yearlyDiscountPct) || 0,
          maxProducts: parseInt(form.maxProducts) || 0,
          maxCashiers: parseInt(form.maxCashiers) || 0,
          maxOutlets: parseInt(form.maxOutlets) || 0,
          features: form.features,
          isActive: form.isActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal menyimpan paket.");
        return;
      }
      onSaved(data.plan);
    } catch {
      setError("Terjadi kesalahan koneksi.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 sticky top-0 bg-white">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Edit {plan.tier}</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Atur detail paket {plan.tier.toLowerCase()}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-5 space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nama Paket
              </label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi</label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Harga Bulanan (Rp)
                </label>
                <input
                  name="monthlyPrice"
                  type="number"
                  min={0}
                  value={form.monthlyPrice}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Harga Tahunan (Rp)
                </label>
                <input
                  name="yearlyPrice"
                  type="number"
                  min={0}
                  value={form.yearlyPrice}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>

            {/* Diskon tahunan */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Label Diskon Tahunan (%)
              </label>
              <div className="flex items-center gap-3">
                <input
                  name="yearlyDiscountPct"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={form.yearlyDiscountPct}
                  onChange={handleChange}
                  className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                {parseFloat(form.yearlyDiscountPct) > 0 ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                    Preview: Hemat {Math.round(parseFloat(form.yearlyDiscountPct))}%
                  </span>
                ) : (
                  <span className="text-xs text-gray-400">
                    0 = tidak tampilkan label diskon
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Label ini ditampilkan di tombol pilih periode tahunan saat checkout. Isi 0 untuk menyembunyikan label.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Batas Produk
                </label>
                <input
                  name="maxProducts"
                  type="number"
                  min={1}
                  value={form.maxProducts}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Batas Kasir
                </label>
                <input
                  name="maxCashiers"
                  type="number"
                  min={1}
                  value={form.maxCashiers}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Batas Cabang
                </label>
                <input
                  name="maxOutlets"
                  type="number"
                  min={1}
                  value={form.maxOutlets}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Fitur</label>
              <div className="space-y-1.5 mb-2">
                {form.features.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-1.5">
                    <span className="flex-1 text-sm text-gray-700">{f}</span>
                    <button
                      type="button"
                      onClick={() => removeFeature(i)}
                      className="text-red-400 hover:text-red-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newFeature}
                  onChange={(e) => setNewFeature(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addFeature();
                    }
                  }}
                  placeholder="Tambah fitur baru"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <button
                  type="button"
                  onClick={addFeature}
                  className="flex items-center gap-1 bg-gray-100 hover:bg-gray-200 px-3 rounded-lg text-sm font-medium"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Tambah
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
              <input
                type="checkbox"
                name="isActive"
                id="isActive"
                checked={form.isActive}
                onChange={handleChange}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <label htmlFor="isActive" className="text-sm text-gray-700">
                Paket aktif (bisa dipilih oleh tenant)
              </label>
            </div>
          </div>

          <div className="p-5 border-t border-gray-200 flex gap-3 sticky bottom-0 bg-white">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2.5 rounded-xl flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                "Simpan Paket"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
