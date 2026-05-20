"use client";

import { useState } from "react";
import { X, Loader2, Eye, EyeOff } from "lucide-react";

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  outletId?: string | null;
  outlet?: { name: string } | null;
  createdAt: Date | string;
}

interface OutletSummary {
  id: string;
  name: string;
  isMain: boolean;
}

interface StaffFormModalProps {
  staff: StaffMember | null;
  outlets: OutletSummary[];
  onClose: () => void;
  onSaved: (staff: StaffMember) => void;
}

export function StaffFormModal({
  staff,
  outlets,
  onClose,
  onSaved,
}: StaffFormModalProps) {
  const isEdit = !!staff;
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Default outlet: yang aktif sebelumnya, atau outlet utama
  const defaultOutletId =
    staff?.outletId ||
    outlets.find((o) => o.isMain)?.id ||
    outlets[0]?.id ||
    "";

  const [form, setForm] = useState({
    name: staff?.name || "",
    email: staff?.email || "",
    password: "",
    isActive: staff?.isActive ?? true,
    outletId: defaultOutletId,
  });

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
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
      const url = isEdit ? `/api/staff/${staff.id}` : "/api/staff";
      const method = isEdit ? "PUT" : "POST";

      const payload: {
        name: string;
        email: string;
        password?: string;
        isActive?: boolean;
        outletId?: string;
      } = {
        name: form.name,
        email: form.email,
        outletId: form.outletId,
      };

      if (!isEdit || form.password) {
        payload.password = form.password;
      }

      if (isEdit) {
        payload.isActive = form.isActive;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Gagal menyimpan data kasir.");
        return;
      }

      onSaved(data.staff);
    } catch {
      setError("Terjadi kesalahan. Silakan coba lagi.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEdit ? "Edit Kasir" : "Tambah Kasir Baru"}
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nama Lengkap <span className="text-red-500">*</span>
            </label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              placeholder="Siti Rahayu"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              required
              placeholder="kasir@toko.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cabang Penugasan <span className="text-red-500">*</span>
            </label>
            <select
              name="outletId"
              value={form.outletId}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {outlets.map((outlet) => (
                <option key={outlet.id} value={outlet.id}>
                  {outlet.name}
                  {outlet.isMain ? " (Utama)" : ""}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">
              Kasir hanya bisa transaksi di cabang yang ditugaskan.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password {!isEdit && <span className="text-red-500">*</span>}
            </label>
            <div className="relative">
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={handleChange}
                required={!isEdit}
                minLength={isEdit ? undefined : 6}
                placeholder={
                  isEdit ? "Kosongkan jika tidak mengubah password" : "Minimal 6 karakter"
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {isEdit && (
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
                Akun aktif (kasir bisa login)
              </label>
            </div>
          )}

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
              ) : isEdit ? (
                "Simpan Perubahan"
              ) : (
                "Tambah Kasir"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
