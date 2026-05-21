"use client";

import { useState } from "react";
import { Tenant } from "@prisma/client";
import { Loader2, Save } from "lucide-react";
import { toast } from "@/components/ui/toaster";
import { ImageUpload } from "@/components/ui/image-upload";

interface SettingsClientProps {
  tenant: Tenant;
}

const PAYMENT_METHODS = [
  { value: "CASH", label: "Tunai" },
  { value: "QRIS", label: "QRIS" },
  { value: "TRANSFER", label: "Transfer Bank" },
  { value: "CARD", label: "Kartu" },
];

export function SettingsClient({ tenant }: SettingsClientProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(tenant.logoUrl || null);

  // Parse activePaymentMethods dari JSON string
  const parsedMethods = (() => {
    try {
      return JSON.parse(tenant.activePaymentMethods || '["CASH","QRIS","TRANSFER"]') as string[];
    } catch {
      return ["CASH", "QRIS", "TRANSFER"];
    }
  })();

  const [form, setForm] = useState({
    name: tenant.name,
    phone: tenant.phone || "",
    address: tenant.address || "",
    city: tenant.city || "",
    currency: tenant.currency,
    taxRate: (tenant.taxRate ?? 0).toString(),
    receiptNote: tenant.receiptNote || "",
    receiptHeader: tenant.receiptHeader || "",
    receiptWidth: (tenant.receiptWidth ?? 80).toString(),
    invoicePrefix: tenant.invoicePrefix || "INV",
    pointsPerAmount: (tenant.pointsPerAmount ?? 10000).toString(),
    pointValue: (tenant.pointValue ?? 100).toString(),
    activePaymentMethods: parsedMethods,
  });

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function togglePaymentMethod(method: string) {
    setForm((prev) => {
      const current = prev.activePaymentMethods;
      if (current.includes(method)) {
        if (current.length <= 1) {
          toast.error("Minimal 1 metode pembayaran harus aktif.");
          return prev;
        }
        return { ...prev, activePaymentMethods: current.filter((m) => m !== method) };
      }
      return { ...prev, activePaymentMethods: [...current, method] };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          address: form.address,
          city: form.city,
          currency: form.currency,
          logoUrl: logoUrl,
          taxRate: parseFloat(form.taxRate) || 0,
          receiptNote: form.receiptNote,
          receiptHeader: form.receiptHeader,
          receiptWidth: parseInt(form.receiptWidth) || 80,
          invoicePrefix: form.invoicePrefix.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) || "INV",
          pointsPerAmount: parseInt(form.pointsPerAmount) || 10000,
          pointValue: parseInt(form.pointValue) || 100,
          activePaymentMethods: form.activePaymentMethods,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Gagal menyimpan pengaturan.");
        return;
      }

      toast.success("Pengaturan berhasil disimpan.");
    } catch {
      toast.error("Terjadi kesalahan. Silakan coba lagi.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pengaturan Toko</h1>
        <p className="text-gray-500 mt-1">Konfigurasi informasi dan preferensi toko Anda</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Informasi Toko */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Informasi Toko</h2>

          {/* Logo Toko */}
          <div className="flex items-start gap-4">
            <ImageUpload
              value={logoUrl}
              onChange={setLogoUrl}
              folder="logos"
              label="Logo Toko"
              size="md"
              shape="square"
            />
            <div className="flex-1 pt-2">
              <p className="text-sm font-medium text-gray-700">Logo Toko</p>
              <p className="text-xs text-gray-400 mt-1">
                Ditampilkan di struk dan halaman toko. Ukuran ideal: 200×200px.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nama Toko</label>
            <input name="name" value={form.name} onChange={handleChange} required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">No. Telepon</label>
              <input name="phone" value={form.phone} onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kota</label>
              <input name="city" value={form.city} onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Alamat</label>
            <textarea name="address" value={form.address} onChange={handleChange} rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        {/* Transaksi */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Pengaturan Transaksi</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PPN (%)</label>
              <input name="taxRate" type="number" min={0} max={100} step={0.1}
                value={form.taxRate} onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              <p className="text-xs text-gray-400 mt-1">0 = tidak ada pajak</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prefix Invoice</label>
              <input name="invoicePrefix" value={form.invoicePrefix} onChange={handleChange}
                placeholder="INV" maxLength={10}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm uppercase" />
              <p className="text-xs text-gray-400 mt-1">Contoh: INV → INV-20260521-0001</p>
            </div>
          </div>

          {/* Metode Pembayaran */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Metode Pembayaran Aktif
            </label>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_METHODS.map((m) => {
                const isActive = form.activePaymentMethods.includes(m.value);
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => togglePaymentMethod(m.value)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                      isActive
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
                    }`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Hanya metode yang dipilih yang akan muncul di halaman kasir
            </p>
          </div>
        </div>

        {/* Loyalitas */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Sistem Poin Loyalitas</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Belanja per Poin (Rp)
              </label>
              <input name="pointsPerAmount" type="number" min={1000} step={1000}
                value={form.pointsPerAmount} onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              <p className="text-xs text-gray-400 mt-1">
                Setiap belanja Rp {parseInt(form.pointsPerAmount || "10000").toLocaleString("id-ID")} = 1 poin
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nilai per Poin (Rp)
              </label>
              <input name="pointValue" type="number" min={1} step={1}
                value={form.pointValue} onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              <p className="text-xs text-gray-400 mt-1">
                1 poin = Rp {parseInt(form.pointValue || "100").toLocaleString("id-ID")} diskon
              </p>
            </div>
          </div>
        </div>

        {/* Struk */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Pengaturan Struk</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lebar Struk</label>
            <select name="receiptWidth" value={form.receiptWidth} onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
              <option value="58">58mm (Thermal kecil)</option>
              <option value="80">80mm (Thermal standar)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Header Struk (Tagline)
            </label>
            <input name="receiptHeader" value={form.receiptHeader} onChange={handleChange}
              placeholder="Contoh: Melayani dengan sepenuh hati"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            <p className="text-xs text-gray-400 mt-1">Ditampilkan di bawah nama toko</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Catatan di Bawah Struk
            </label>
            <input name="receiptNote" value={form.receiptNote} onChange={handleChange}
              placeholder="Terima kasih telah berbelanja!"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium px-6 py-2.5 rounded-xl transition-colors"
        >
          {isLoading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...</>
          ) : (
            <><Save className="w-4 h-4" /> Simpan Semua Pengaturan</>
          )}
        </button>
      </form>
    </div>
  );
}
