"use client";

import { useState } from "react";
import { Tenant, BusinessType } from "@prisma/client";
import { Loader2, Save } from "lucide-react";
import { toast } from "@/components/ui/toaster";
import { ImageUpload } from "@/components/ui/image-upload";
import { OfflinePinManager } from "@/components/pwa/offline-pin-manager";
import { BUSINESS_FEATURES } from "@/lib/business-features";
import { useRouter } from "next/navigation";

interface StaffMember {
  id: string;
  name: string;
  role: string;
}

interface SettingsClientProps {
  tenant: Tenant;
  staff: StaffMember[];
}

const PAYMENT_METHODS = [
  { value: "CASH", label: "Tunai" },
  { value: "QRIS", label: "QRIS" },
  { value: "TRANSFER", label: "Transfer Bank" },
  { value: "CARD", label: "Kartu" },
];

export function SettingsClient({ tenant, staff }: SettingsClientProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isChangingType, setIsChangingType] = useState(false);
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
    taxRate: (tenant.taxRate ?? 0).toString(),
    receiptNote: tenant.receiptNote || "",
    receiptHeader: tenant.receiptHeader || "",
    receiptWidth: (tenant.receiptWidth ?? 80).toString(),
    invoicePrefix: tenant.invoicePrefix || "INV",
    pointsPerAmount: (tenant.pointsPerAmount ?? 10000).toString(),
    pointValue: (tenant.pointValue ?? 100).toString(),
    activePaymentMethods: parsedMethods,
    serviceChargePct: ((tenant as { serviceChargePct?: number }).serviceChargePct ?? 0).toString(),
    paymentFlow: ((tenant as { paymentFlow?: string }).paymentFlow ?? "PAY_FIRST") as "PAY_FIRST" | "PAY_LATER",
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
          logoUrl: logoUrl,
          taxRate: parseFloat(form.taxRate) || 0,
          receiptNote: form.receiptNote,
          receiptHeader: form.receiptHeader,
          receiptWidth: parseInt(form.receiptWidth) || 80,
          invoicePrefix: form.invoicePrefix.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) || "INV",
          pointsPerAmount: parseInt(form.pointsPerAmount) || 10000,
          pointValue: parseInt(form.pointValue) || 100,
          activePaymentMethods: form.activePaymentMethods,
          serviceChargePct: parseFloat(form.serviceChargePct) || 0,
          paymentFlow: form.paymentFlow,
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <p className="text-xs text-gray-400 mt-1">Contoh prefix: INV</p>
            </div>
          </div>

          {/* Service charge — hanya tampil untuk F&B */}
          {(tenant as { businessType?: string }).businessType === "FNB" && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Service Charge (%)
                </label>
                <input name="serviceChargePct" type="number" min={0} max={100} step={0.5}
                  value={form.serviceChargePct} onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                <p className="text-xs text-gray-400 mt-1">
                  Biaya layanan yang ditambahkan ke setiap transaksi. 0 = tidak ada service charge.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Alur Pembayaran
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className={`flex items-start gap-2 p-3 border-2 rounded-xl cursor-pointer transition-colors ${
                    form.paymentFlow === "PAY_FIRST"
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}>
                    <input
                      type="radio"
                      name="paymentFlow"
                      value="PAY_FIRST"
                      checked={form.paymentFlow === "PAY_FIRST"}
                      onChange={() => setForm((p) => ({ ...p, paymentFlow: "PAY_FIRST" }))}
                      className="mt-1"
                    />
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Bayar Di Depan</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Customer pesan → bayar dulu → masuk dapur. Cocok untuk self-service, fast food, kantin.
                      </p>
                    </div>
                  </label>
                  <label className={`flex items-start gap-2 p-3 border-2 rounded-xl cursor-pointer transition-colors ${
                    form.paymentFlow === "PAY_LATER"
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}>
                    <input
                      type="radio"
                      name="paymentFlow"
                      value="PAY_LATER"
                      checked={form.paymentFlow === "PAY_LATER"}
                      onChange={() => setForm((p) => ({ ...p, paymentFlow: "PAY_LATER" }))}
                      className="mt-1"
                    />
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Bayar Belakangan</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Customer duduk → pesan → makan → minta bill → bayar. Cocok untuk kafe/restoran tradisional.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </>
          )}

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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

      {/* PIN Offline — di luar form agar tidak ikut submit */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div>
          <h2 className="font-semibold text-gray-900">PIN Offline Kasir</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Atur PIN untuk kasir agar bisa mengakses halaman kasir saat tidak ada internet
          </p>
        </div>
        <OfflinePinManager staff={staff} />
      </div>

      {/* Tipe Bisnis */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div>
          <h2 className="font-semibold text-gray-900">Tipe Bisnis</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Mengubah tipe bisnis akan menyesuaikan tampilan sidebar dan label menu. Data tidak akan hilang.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {(Object.keys(BUSINESS_FEATURES) as BusinessType[]).map((type) => {
            const config = BUSINESS_FEATURES[type];
            const isCurrent = tenant.businessType === type;
            return (
              <button
                key={type}
                type="button"
                disabled={isCurrent || isChangingType}
                onClick={async () => {
                  setIsChangingType(true);
                  try {
                    const res = await fetch("/api/settings/business-type", {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ businessType: type }),
                    });
                    if (!res.ok) {
                      const data = await res.json();
                      toast.error(data.error || "Gagal mengubah tipe bisnis.");
                      return;
                    }
                    toast.success(`Tipe bisnis diubah ke ${config.displayName}. Halaman akan dimuat ulang.`);
                    setTimeout(() => router.refresh(), 1000);
                  } catch {
                    toast.error("Terjadi kesalahan.");
                  } finally {
                    setIsChangingType(false);
                  }
                }}
                className={`p-3 rounded-xl border-2 text-left transition-all ${
                  isCurrent
                    ? "border-blue-500 bg-blue-50 cursor-default"
                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50 disabled:opacity-50"
                }`}
              >
                <div className="text-xl mb-1">{config.emoji}</div>
                <p className="font-semibold text-gray-900 text-sm">{config.displayName}</p>
                {isCurrent && (
                  <span className="text-xs text-blue-600 font-medium">Aktif</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
