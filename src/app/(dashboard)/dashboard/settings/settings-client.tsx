"use client";

import { useState, useEffect, useCallback } from "react";
import { Tenant, BusinessType } from "@prisma/client";
import { Loader2, Save, AlertTriangle, CheckCircle } from "lucide-react";
import { toast } from "@/components/ui/toaster";
import { ImageUpload } from "@/components/ui/image-upload";
import { OfflinePinManager } from "@/components/pwa/offline-pin-manager";
import { BUSINESS_FEATURES } from "@/lib/business-features";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";

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
  const [isChangingType, setIsChangingType] = useState<BusinessType | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(tenant.logoUrl || null);
  const [isDirty, setIsDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const parsedMethods = (() => {
    try {
      return JSON.parse(tenant.activePaymentMethods || '["CASH","QRIS","TRANSFER"]') as string[];
    } catch {
      return ["CASH", "QRIS", "TRANSFER"];
    }
  })();

  const initialForm = {
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
    serviceChargePct: (tenant.serviceChargePct ?? 0).toString(),
    paymentFlow: (tenant.paymentFlow ?? "PAY_FIRST") as "PAY_FIRST" | "PAY_LATER",
  };

  const [form, setForm] = useState(initialForm);

  // Track dirty state
  useEffect(() => {
    const dirty =
      JSON.stringify(form) !== JSON.stringify(initialForm) ||
      logoUrl !== (tenant.logoUrl || null);
    setIsDirty(dirty);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, logoUrl]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target;
    // Auto-uppercase prefix invoice
    const finalValue = name === "invoicePrefix"
      ? value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10)
      : value;
    setForm((prev) => ({ ...prev, [name]: finalValue }));
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

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
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
          logoUrl,
          taxRate: parseFloat(form.taxRate) || 0,
          receiptNote: form.receiptNote,
          receiptHeader: form.receiptHeader,
          receiptWidth: parseInt(form.receiptWidth) || 80,
          invoicePrefix: form.invoicePrefix || "INV",
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
      setIsDirty(false);
      setSavedAt(new Date());
    } catch {
      toast.error("Terjadi kesalahan. Silakan coba lagi.");
    } finally {
      setIsLoading(false);
    }
  }, [form, logoUrl]);

  // Keyboard shortcut Ctrl+S / Cmd+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (isDirty && !isLoading) handleSubmit();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDirty, isLoading, handleSubmit]);

  const pointsPerAmountNum = parseInt(form.pointsPerAmount) || 0;
  const pointValueNum = parseInt(form.pointValue) || 0;

  return (
    <div className="max-w-2xl space-y-5">
      {/* Header + sticky save bar */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pengaturan Toko</h1>
          <p className="text-gray-500 mt-1">Konfigurasi informasi dan preferensi toko Anda</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {savedAt && !isDirty && (
            <span className="text-xs text-green-600 flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" />
              Tersimpan {savedAt.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          {isDirty && (
            <span className="text-xs text-amber-600 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              Ada perubahan belum disimpan
            </span>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ── Informasi Toko ─────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Informasi Toko</h2>

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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nama Toko <span className="text-red-500">*</span>
            </label>
            <input name="name" value={form.name} onChange={handleChange} required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">No. Telepon</label>
              <input name="phone" value={form.phone} onChange={handleChange}
                placeholder="08xxxxxxxxxx"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kota</label>
              <input name="city" value={form.city} onChange={handleChange}
                placeholder="Jakarta"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Alamat</label>
            <textarea name="address" value={form.address} onChange={handleChange} rows={2}
              placeholder="Jl. Contoh No. 1"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
        </div>

        {/* ── Pengaturan Transaksi ───────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Pengaturan Transaksi</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PPN (%)</label>
              <input name="taxRate" type="number" min={0} max={100} step={0.1}
                value={form.taxRate} onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              <p className="text-xs text-gray-400 mt-1">
                {parseFloat(form.taxRate) > 0
                  ? `Setiap transaksi dikenakan PPN ${form.taxRate}%`
                  : "0 = tidak ada pajak"}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prefix Invoice</label>
              <input name="invoicePrefix" value={form.invoicePrefix} onChange={handleChange}
                placeholder="INV" maxLength={10}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono uppercase tracking-wider" />
              <p className="text-xs text-gray-400 mt-1">
                Contoh: <span className="font-mono">{form.invoicePrefix || "INV"}-20260101-001</span>
              </p>
            </div>
          </div>

          {/* F&B only */}
          {tenant.businessType === "FNB" && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Service Charge (%)
                </label>
                <input name="serviceChargePct" type="number" min={0} max={100} step={0.5}
                  value={form.serviceChargePct} onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                <p className="text-xs text-gray-400 mt-1">
                  {parseFloat(form.serviceChargePct) > 0
                    ? `Ditambahkan ke setiap transaksi sebelum pajak`
                    : "0 = tidak ada service charge"}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Alur Pembayaran
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(["PAY_FIRST", "PAY_LATER"] as const).map((flow) => {
                    const isSelected = form.paymentFlow === flow;
                    return (
                      <label
                        key={flow}
                        className={`flex items-start gap-3 p-3 border-2 rounded-xl cursor-pointer transition-colors ${
                          isSelected
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <input
                          type="radio"
                          name="paymentFlow"
                          value={flow}
                          checked={isSelected}
                          onChange={() => setForm((p) => ({ ...p, paymentFlow: flow }))}
                          className="mt-0.5 flex-shrink-0"
                        />
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {flow === "PAY_FIRST" ? "Bayar Di Depan" : "Bayar Belakangan"}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {flow === "PAY_FIRST"
                              ? "Pesan → bayar → masuk dapur. Cocok untuk self-service & fast food."
                              : "Pesan → makan → minta bill → bayar. Cocok untuk kafe & restoran."}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
                <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                  Tidak bisa diubah saat ada order meja aktif
                </p>
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
              Hanya metode yang dipilih yang muncul di halaman kasir
            </p>
          </div>
        </div>

        {/* ── Sistem Poin Loyalitas ──────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Sistem Poin Loyalitas</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Minimal belanja untuk 1 poin (Rp)
              </label>
              <input name="pointsPerAmount" type="number" min={1000} step={1000}
                value={form.pointsPerAmount} onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              <p className="text-xs text-gray-400 mt-1">
                {pointsPerAmountNum > 0
                  ? `Belanja ${formatCurrency(pointsPerAmountNum)} = 1 poin`
                  : "Masukkan nilai yang valid"}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nilai tukar 1 poin (Rp)
              </label>
              <input name="pointValue" type="number" min={1} step={1}
                value={form.pointValue} onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              <p className="text-xs text-gray-400 mt-1">
                {pointValueNum > 0
                  ? `1 poin = diskon ${formatCurrency(pointValueNum)}`
                  : "Masukkan nilai yang valid"}
              </p>
            </div>
          </div>

          {/* Preview kalkulasi poin */}
          {pointsPerAmountNum > 0 && pointValueNum > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
              Contoh: Belanja {formatCurrency(pointsPerAmountNum * 10)} → dapat 10 poin → bisa tukar diskon {formatCurrency(pointValueNum * 10)}
            </div>
          )}
        </div>

        {/* ── Pengaturan Struk ───────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Pengaturan Struk</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lebar Struk</label>
            <select name="receiptWidth" value={form.receiptWidth} onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
              <option value="58">58mm — Thermal kecil (32 karakter/baris)</option>
              <option value="80">80mm — Thermal standar (46 karakter/baris)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Header Struk (Tagline)
            </label>
            <input name="receiptHeader" value={form.receiptHeader} onChange={handleChange}
              placeholder="Melayani dengan sepenuh hati"
              maxLength={200}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            <p className="text-xs text-gray-400 mt-1">
              Ditampilkan di bawah nama toko · {form.receiptHeader.length}/200 karakter
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Catatan di Bawah Struk
            </label>
            <input name="receiptNote" value={form.receiptNote} onChange={handleChange}
              placeholder="Terima kasih telah berbelanja!"
              maxLength={300}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            <p className="text-xs text-gray-400 mt-1">
              {form.receiptNote.length}/300 karakter
            </p>
          </div>

          {/* Preview struk mini */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Preview Struk</p>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 font-mono text-xs text-gray-700 leading-relaxed"
              style={{ maxWidth: form.receiptWidth === "58" ? "200px" : "280px" }}>
              <p className="font-bold text-center uppercase">{form.name || "Nama Toko"}</p>
              {form.receiptHeader && (
                <p className="text-center italic text-gray-500">{form.receiptHeader}</p>
              )}
              <p className="text-center text-gray-400">{"- ".repeat(form.receiptWidth === "58" ? 16 : 23)}</p>
              <p className="text-center text-gray-400 text-[10px]">... item transaksi ...</p>
              <p className="text-center text-gray-400">{"- ".repeat(form.receiptWidth === "58" ? 16 : 23)}</p>
              <p className="text-center">{form.receiptNote || "Terima kasih telah berbelanja!"}</p>
            </div>
          </div>
        </div>

        {/* ── Sticky Save Button ─────────────────────── */}
        <div className={`sticky bottom-4 z-10 transition-all ${isDirty ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
          <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 flex items-center justify-between gap-4">
            <p className="text-sm text-gray-600">
              Ada perubahan yang belum disimpan
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setForm(initialForm);
                  setLogoUrl(tenant.logoUrl || null);
                }}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Batalkan
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium px-5 py-2 rounded-lg text-sm transition-colors"
              >
                {isLoading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...</>
                ) : (
                  <><Save className="w-4 h-4" /> Simpan</>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Fallback save button (selalu ada) */}
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

      {/* ── PIN Offline ────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div>
          <h2 className="font-semibold text-gray-900">PIN Offline Kasir</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Atur PIN 6 digit untuk kasir agar bisa mengakses halaman kasir saat tidak ada internet.
            Sesi PIN berlaku 8 jam.
          </p>
        </div>
        <OfflinePinManager staff={staff} />
      </div>

      {/* ── Tipe Bisnis ────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div>
          <h2 className="font-semibold text-gray-900">Tipe Bisnis</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Mengubah tipe bisnis menyesuaikan tampilan sidebar dan label menu. Data tidak akan hilang.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {(Object.keys(BUSINESS_FEATURES) as BusinessType[]).map((type) => {
            const config = BUSINESS_FEATURES[type];
            const isCurrent = tenant.businessType === type;
            const isLoadingThis = isChangingType === type;
            return (
              <button
                key={type}
                type="button"
                disabled={isCurrent || isChangingType !== null}
                title={config.description}
                onClick={async () => {
                  setIsChangingType(type);
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
                    toast.success(`Tipe bisnis diubah ke ${config.displayName}.`);
                    setTimeout(() => router.refresh(), 800);
                  } catch {
                    toast.error("Terjadi kesalahan.");
                  } finally {
                    setIsChangingType(null);
                  }
                }}
                className={`p-3 rounded-xl border-2 text-left transition-all ${
                  isCurrent
                    ? "border-blue-500 bg-blue-50 cursor-default"
                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xl">{config.emoji}</span>
                  {isLoadingThis && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
                  {isCurrent && !isLoadingThis && (
                    <span className="text-xs text-blue-600 font-medium bg-blue-100 px-1.5 py-0.5 rounded-full">Aktif</span>
                  )}
                </div>
                <p className="font-semibold text-gray-900 text-sm">{config.displayName}</p>
                <p className="text-xs text-gray-400 mt-0.5 leading-tight">{config.description}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
