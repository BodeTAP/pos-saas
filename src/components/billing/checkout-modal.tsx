"use client";

import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { X, Loader2, CreditCard, ExternalLink, CheckCircle } from "lucide-react";
import Image from "next/image";

interface PaymentChannel {
  group: string;
  code: string;
  name: string;
  type: string;
  total_fee: { flat: number; percent: string };
  icon_url: string;
  active: boolean;
}

interface PlanSummary {
  tier: string;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
}

interface CheckoutModalProps {
  plan: "PRO" | "ENTERPRISE";
  onClose: () => void;
}

interface CheckoutResult {
  invoiceNumber: string;
  amount: number;
  checkoutUrl: string;
  payCode?: string;
  qrUrl?: string;
}

export function CheckoutModal({ plan, onClose }: CheckoutModalProps) {
  const [period, setPeriod] = useState<"MONTHLY" | "YEARLY">("MONTHLY");
  const [planInfo, setPlanInfo] = useState<PlanSummary | null>(null);
  const [channels, setChannels] = useState<PaymentChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string>("");
  const [isLoadingChannels, setIsLoadingChannels] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CheckoutResult | null>(null);

  const amount = planInfo
    ? period === "YEARLY"
      ? planInfo.yearlyPrice
      : planInfo.monthlyPrice
    : 0;

  // Load plan pricing dari DB
  useEffect(() => {
    async function loadPlan() {
      try {
        const res = await fetch("/api/plans");
        const data = await res.json();
        const found = data.plans?.find((p: PlanSummary) => p.tier === plan);
        if (found) setPlanInfo(found);
      } catch {
        setError("Gagal memuat informasi paket");
      }
    }
    loadPlan();
  }, [plan]);

  useEffect(() => {
    async function loadChannels() {
      try {
        const res = await fetch("/api/billing/channels");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setChannels(data.channels);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal memuat metode pembayaran");
      } finally {
        setIsLoadingChannels(false);
      }
    }
    loadChannels();
  }, []);

  // Group channels by group untuk display
  const groupedChannels = channels.reduce<Record<string, PaymentChannel[]>>(
    (acc, ch) => {
      if (!acc[ch.group]) acc[ch.group] = [];
      acc[ch.group].push(ch);
      return acc;
    },
    {}
  );

  async function handleCheckout() {
    if (!selectedChannel) {
      setError("Pilih metode pembayaran terlebih dahulu.");
      return;
    }

    setIsProcessing(true);
    setError("");

    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, period, paymentMethod: selectedChannel }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Gagal membuat pembayaran.");
        return;
      }

      setResult({
        invoiceNumber: data.invoice.invoiceNumber,
        amount: data.invoice.amount,
        checkoutUrl: data.checkoutUrl,
        payCode: data.payCode,
        qrUrl: data.qrUrl,
      });
    } catch {
      setError("Terjadi kesalahan koneksi. Silakan coba lagi.");
    } finally {
      setIsProcessing(false);
    }
  }

  // Result screen
  if (result) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl max-w-md w-full">
          <div className="p-6 text-center border-b border-gray-100">
            <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <CreditCard className="w-7 h-7 text-blue-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Tagihan Dibuat</h2>
            <p className="text-gray-500 text-sm mt-0.5">{result.invoiceNumber}</p>
          </div>

          <div className="p-6 space-y-4">
            <div className="bg-blue-50 rounded-xl p-4 text-center">
              <p className="text-sm text-blue-600 mb-1">Total Pembayaran</p>
              <p className="text-2xl font-bold text-blue-700">
                {formatCurrency(result.amount)}
              </p>
            </div>

            {result.payCode && (
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">Kode Pembayaran</p>
                <p className="text-xl font-bold text-gray-900 font-mono tracking-wider">
                  {result.payCode}
                </p>
              </div>
            )}

            {result.qrUrl && (
              <div className="flex justify-center">
                <Image
                  src={result.qrUrl}
                  alt="QR Code Pembayaran"
                  width={200}
                  height={200}
                  unoptimized
                />
              </div>
            )}

            <a
              href={result.checkoutUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Buka Halaman Pembayaran
            </a>

            <p className="text-xs text-gray-400 text-center">
              Status langganan akan otomatis aktif setelah pembayaran berhasil.
            </p>

            <button
              onClick={onClose}
              className="w-full px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Berlangganan {planInfo?.name || "..."}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">Pembayaran via Tripay</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Period Toggle */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Periode Langganan</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setPeriod("MONTHLY")}
                className={`p-3 rounded-xl border-2 text-left transition-colors ${
                  period === "MONTHLY"
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <p className="text-sm font-semibold text-gray-900">Bulanan</p>
                <p className="text-lg font-bold text-blue-600 mt-0.5">
                  {formatCurrency(planInfo?.monthlyPrice || 0)}
                </p>
                <p className="text-xs text-gray-500">per bulan</p>
              </button>
              <button
                onClick={() => setPeriod("YEARLY")}
                className={`p-3 rounded-xl border-2 text-left transition-colors relative ${
                  period === "YEARLY"
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <span className="absolute -top-2 right-2 bg-green-100 text-green-700 text-xs px-1.5 py-0.5 rounded-full font-medium">
                  Hemat 17%
                </span>
                <p className="text-sm font-semibold text-gray-900">Tahunan</p>
                <p className="text-lg font-bold text-blue-600 mt-0.5">
                  {formatCurrency(planInfo?.yearlyPrice || 0)}
                </p>
                <p className="text-xs text-gray-500">per tahun</p>
              </button>
            </div>
          </div>

          {/* Payment Channels */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Metode Pembayaran</p>
            {isLoadingChannels ? (
              <div className="flex items-center justify-center py-8 text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Memuat metode pembayaran...
              </div>
            ) : Object.keys(groupedChannels).length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">
                Tidak ada metode pembayaran tersedia
              </p>
            ) : (
              <div className="space-y-3">
                {Object.entries(groupedChannels).map(([group, items]) => (
                  <div key={group}>
                    <p className="text-xs text-gray-500 mb-1.5 uppercase tracking-wide">
                      {group}
                    </p>
                    <div className="grid grid-cols-1 gap-1.5">
                      {items.map((ch) => (
                        <label
                          key={ch.code}
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            selectedChannel === ch.code
                              ? "border-blue-500 bg-blue-50"
                              : "border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          <input
                            type="radio"
                            name="channel"
                            value={ch.code}
                            checked={selectedChannel === ch.code}
                            onChange={(e) => setSelectedChannel(e.target.value)}
                            className="w-4 h-4 text-blue-600"
                          />
                          {ch.icon_url && (
                            <Image
                              src={ch.icon_url}
                              alt={ch.name}
                              width={32}
                              height={20}
                              className="object-contain"
                              unoptimized
                            />
                          )}
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">{ch.name}</p>
                            {(ch.total_fee.flat > 0 || ch.total_fee.percent !== "0") && (
                              <p className="text-xs text-gray-500">
                                Biaya: {ch.total_fee.flat > 0 && `${formatCurrency(ch.total_fee.flat)} `}
                                {ch.total_fee.percent !== "0" && `${ch.total_fee.percent}%`}
                              </p>
                            )}
                          </div>
                          {selectedChannel === ch.code && (
                            <CheckCircle className="w-4 h-4 text-blue-600" />
                          )}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Total */}
          <div className="bg-gray-50 rounded-xl p-4 flex justify-between items-center">
            <span className="text-sm text-gray-600">Total Pembayaran</span>
            <span className="text-xl font-bold text-blue-600">{formatCurrency(amount)}</span>
          </div>
        </div>

        <div className="p-5 border-t border-gray-200">
          <button
            onClick={handleCheckout}
            disabled={isProcessing || !selectedChannel}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Memproses...
              </>
            ) : (
              "Bayar Sekarang"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
