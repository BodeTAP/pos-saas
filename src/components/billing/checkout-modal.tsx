"use client";

import { useEffect, useState, useRef } from "react";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  X,
  Loader2,
  CreditCard,
  ExternalLink,
  CheckCircle,
  ArrowLeft,
  PartyPopper,
  Clock,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
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
  features: string[];
}

interface TenantInfo {
  plan: string;
  subscriptionEndsAt: Date | null;
}

interface CheckoutModalProps {
  plan: "PRO" | "ENTERPRISE";
  mode: "normal" | "upgrade"; // upgrade = pakai /api/billing/upgrade
  tenant: TenantInfo;
  onClose: () => void;
  onSuccess: () => void;
}

interface CheckoutResult {
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  checkoutUrl: string;
  payCode?: string;
  qrUrl?: string;
  periodEnd: Date; // estimasi tanggal berakhir
}

// Step 1: Konfirmasi → Step 2: Pilih Metode → Step 3: Bayar → Step 4: Sukses
type Step = "confirm" | "payment" | "waiting" | "success";

const AUTO_POLL_INTERVAL = 5000; // 5 detik
const AUTO_POLL_MAX = 60; // max 5 menit (60 × 5 detik)

export function CheckoutModal({ plan, mode, tenant, onClose, onSuccess }: CheckoutModalProps) {
  const [step, setStep] = useState<Step>("confirm");
  const [period, setPeriod] = useState<"MONTHLY" | "YEARLY">("MONTHLY");
  const [planInfo, setPlanInfo] = useState<PlanSummary | null>(null);
  const [channels, setChannels] = useState<PaymentChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string>("");
  const [isLoadingChannels, setIsLoadingChannels] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CheckoutResult | null>(null);
  const [pollCount, setPollCount] = useState(0);
  const [isPolling, setIsPolling] = useState(false);
  const [manualChecking, setManualChecking] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // FIX 14: Track whether Tripay tab has already been opened to prevent duplicate opens on re-render
  const tripayOpenedRef = useRef(false);

  const amount = planInfo
    ? period === "YEARLY"
      ? planInfo.yearlyPrice
      : planInfo.monthlyPrice
    : 0;

  // Hitung estimasi tanggal berakhir
  function calcPeriodEnd(p: "MONTHLY" | "YEARLY"): Date {
    const now = new Date();
    const base =
      tenant.subscriptionEndsAt && tenant.subscriptionEndsAt > now
        ? new Date(tenant.subscriptionEndsAt)
        : now;
    const end = new Date(base);
    if (p === "YEARLY") end.setFullYear(end.getFullYear() + 1);
    else end.setMonth(end.getMonth() + 1);
    return end;
  }

  // Load plan info
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

  // Load channels saat masuk step payment
  useEffect(() => {
    if (step !== "payment") return;
    async function loadChannels() {
      setIsLoadingChannels(true);
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
  }, [step]);

  // FIX 14: Reset tripayOpenedRef when leaving the waiting step
  useEffect(() => {
    if (step !== "waiting") {
      tripayOpenedRef.current = false;
    }
  }, [step]);

  // Auto-polling saat step "waiting"
  useEffect(() => {
    if (step !== "waiting" || !result) return;

    // Auto-redirect ke Tripay saat pertama masuk step waiting (only once)
    if (result.checkoutUrl && !tripayOpenedRef.current) {
      tripayOpenedRef.current = true;
      window.open(result.checkoutUrl, "_blank");
    }

    function startPolling() {
      pollTimerRef.current = setInterval(async () => {
        setPollCount((c) => {
          if (c >= AUTO_POLL_MAX) {
            clearInterval(pollTimerRef.current!);
            setIsPolling(false);
            return c;
          }
          return c + 1;
        });

        setIsPolling(true);
        try {
          const invoiceId = result?.invoiceId;
          if (!invoiceId) return;
          const res = await fetch(`/api/billing/check-status/${invoiceId}`, {
            method: "POST",
          });
          const data = await res.json();
          if (data.status === "PAID") {
            clearInterval(pollTimerRef.current!);
            setStep("success");
          } else if (data.status === "EXPIRED" || data.status === "FAILED") {
            clearInterval(pollTimerRef.current!);
            setError(`Pembayaran ${data.status.toLowerCase()}. Silakan coba lagi.`);
            setStep("payment");
          }
        } catch {
          // Diam saja, retry di interval berikutnya
        } finally {
          setIsPolling(false);
        }
      }, AUTO_POLL_INTERVAL);
    }

    startPolling();
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [step, result]);

  // Manual cek status
  async function handleManualCheck() {
    if (!result) return;
    setManualChecking(true);
    try {
      const res = await fetch(`/api/billing/check-status/${result!.invoiceId}`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.status === "PAID") {
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        setStep("success");
      } else if (data.status === "EXPIRED" || data.status === "FAILED") {
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        setError(`Pembayaran ${data.status.toLowerCase()}. Silakan coba lagi.`);
        setStep("payment");
      } else {
        setError("Pembayaran belum diterima. Silakan selesaikan pembayaran di Tripay.");
      }
    } catch {
      setError("Gagal mengecek status. Coba lagi.");
    } finally {
      setManualChecking(false);
    }
  }

  async function handleCheckout() {
    if (!selectedChannel) {
      setError("Pilih metode pembayaran terlebih dahulu.");
      return;
    }
    setIsProcessing(true);
    setError("");
    try {
      const endpoint = mode === "upgrade" ? "/api/billing/upgrade" : "/api/billing/checkout";
      const res = await fetch(endpoint, {
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
        invoiceId: data.invoice.id,
        invoiceNumber: data.invoice.invoiceNumber,
        amount: data.invoice.amount,
        checkoutUrl: data.checkoutUrl,
        payCode: data.payCode,
        qrUrl: data.qrUrl,
        periodEnd: calcPeriodEnd(period),
      });
      setStep("waiting");
    } catch {
      setError("Terjadi kesalahan koneksi. Silakan coba lagi.");
    } finally {
      setIsProcessing(false);
    }
  }

  const groupedChannels = channels.reduce<Record<string, PaymentChannel[]>>(
    (acc, ch) => {
      if (!acc[ch.group]) acc[ch.group] = [];
      acc[ch.group].push(ch);
      return acc;
    },
    {}
  );

  const isCurrent = tenant.plan === plan;
  const isRenewal =
    isCurrent &&
    tenant.subscriptionEndsAt &&
    tenant.subscriptionEndsAt > new Date();

  // ── STEP: CONFIRM ──────────────────────────────────────────
  if (step === "confirm") {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl max-w-md w-full">
          <div className="flex items-center justify-between p-5 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              {isRenewal ? `Perpanjang ${planInfo?.name || plan}` : `Berlangganan ${planInfo?.name || plan}`}
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5 space-y-4">
            {/* Periode */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Pilih Periode</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setPeriod("MONTHLY")}
                  className={`p-3 rounded-xl border-2 text-left transition-colors ${
                    period === "MONTHLY" ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
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
                    period === "YEARLY" ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
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

            {/* Ringkasan pesanan */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <p className="text-sm font-semibold text-gray-700">Ringkasan Pesanan</p>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">{planInfo?.name || plan}</span>
                <span className="font-medium">{period === "YEARLY" ? "Tahunan" : "Bulanan"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Aktif hingga</span>
                <span className="font-medium text-green-700">
                  {formatDate(calcPeriodEnd(period))}
                </span>
              </div>
              {isRenewal && tenant.subscriptionEndsAt && (
                <div className="text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2 mt-1">
                  Sisa masa aktif saat ini akan ditambahkan ke periode baru.
                </div>
              )}
              {mode === "upgrade" && (
                <div className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2 mt-1">
                  Paket saat ini langsung berakhir. Paket baru mulai dari sekarang.
                </div>
              )}
              <div className="border-t border-gray-200 pt-2 flex justify-between font-bold">
                <span>Total</span>
                <span className="text-blue-600 text-lg">{formatCurrency(amount)}</span>
              </div>
            </div>

            {/* Fitur yang didapat */}
            {planInfo?.features && (
              <div>
                <p className="text-xs text-gray-500 mb-2">Yang kamu dapatkan:</p>
                <ul className="space-y-1">
                  {planInfo.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                      <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="p-5 border-t border-gray-200 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50"
            >
              Batal
            </button>
            <button
              onClick={() => setStep("payment")}
              disabled={!planInfo}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-semibold py-2.5 rounded-xl transition-colors"
            >
              Lanjut Bayar →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── STEP: PAYMENT ──────────────────────────────────────────
  if (step === "payment") {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-5 border-b border-gray-200 sticky top-0 bg-white z-10">
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setStep("confirm"); setError(""); }}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Pilih Metode Bayar</h2>
                <p className="text-xs text-gray-500">
                  {planInfo?.name} · {period === "YEARLY" ? "Tahunan" : "Bulanan"} · {formatCurrency(amount)}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5 space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                {error}
              </div>
            )}

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
                    <p className="text-xs text-gray-500 mb-1.5 uppercase tracking-wide">{group}</p>
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
                            <Image src={ch.icon_url} alt={ch.name} width={32} height={20} className="object-contain" unoptimized />
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
                          {selectedChannel === ch.code && <CheckCircle className="w-4 h-4 text-blue-600" />}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

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
                <><Loader2 className="w-4 h-4 animate-spin" /> Membuat tagihan...</>
              ) : (
                "Konfirmasi & Bayar"
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── STEP: WAITING ──────────────────────────────────────────
  if (step === "waiting" && result) {
    const pollProgress = Math.min((pollCount / AUTO_POLL_MAX) * 100, 100);
    const timeLeft = Math.max(0, (AUTO_POLL_MAX - pollCount) * (AUTO_POLL_INTERVAL / 1000));
    const minutesLeft = Math.floor(timeLeft / 60);
    const secondsLeft = timeLeft % 60;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl max-w-md w-full">
          <div className="p-6 text-center border-b border-gray-100">
            <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <CreditCard className="w-7 h-7 text-blue-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Menunggu Pembayaran</h2>
            <p className="text-gray-500 text-sm mt-0.5">{result.invoiceNumber}</p>
          </div>

          <div className="p-6 space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="bg-blue-50 rounded-xl p-4 text-center">
              <p className="text-sm text-blue-600 mb-1">Total Pembayaran</p>
              <p className="text-2xl font-bold text-blue-700">{formatCurrency(result.amount)}</p>
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
                <Image src={result.qrUrl} alt="QR Code" width={180} height={180} unoptimized />
              </div>
            )}

            {/* Auto-polling indicator */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  {isPolling ? (
                    <><Loader2 className="w-3 h-3 animate-spin" /> Mengecek status...</>
                  ) : (
                    <><Clock className="w-3 h-3" /> Cek otomatis aktif</>
                  )}
                </span>
                {pollCount < AUTO_POLL_MAX && (
                  <span>
                    {minutesLeft > 0 ? `${minutesLeft}m ` : ""}{secondsLeft}d tersisa
                  </span>
                )}
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div
                  className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${100 - pollProgress}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 text-center">
                Status akan diperbarui otomatis setelah pembayaran berhasil
              </p>
            </div>

            <div className="flex gap-2">
              <a
                href={result.checkoutUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl text-sm transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Buka Tripay
              </a>
              <button
                onClick={handleManualCheck}
                disabled={manualChecking}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                title="Cek status sekarang"
              >
                {manualChecking ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Cek
              </button>
            </div>

            <button
              onClick={onClose}
              className="w-full text-sm text-gray-500 hover:text-gray-700 py-2"
            >
              Tutup (tagihan tetap aktif)
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── STEP: SUCCESS ──────────────────────────────────────────
  if (step === "success" && result) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl max-w-sm w-full">
          <div className="p-8 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <PartyPopper className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Selamat!</h2>
            <p className="text-gray-500 mb-6">
              Paket <strong>{planInfo?.name}</strong> kamu telah aktif.
            </p>

            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 space-y-2 text-left">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Paket</span>
                <span className="font-semibold text-gray-900">{planInfo?.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Periode</span>
                <span className="font-semibold text-gray-900">
                  {period === "YEARLY" ? "Tahunan" : "Bulanan"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Aktif hingga</span>
                <span className="font-semibold text-green-700">
                  {formatDate(result.periodEnd)}
                </span>
              </div>
              <div className="flex justify-between text-sm border-t border-green-200 pt-2">
                <span className="text-gray-600">Dibayar</span>
                <span className="font-bold text-gray-900">{formatCurrency(result.amount)}</span>
              </div>
            </div>

            <button
              onClick={() => {
                onSuccess();
                onClose();
              }}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              Mulai Gunakan Fitur Baru
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
