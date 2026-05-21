"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toaster";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  CheckCircle,
  Clock,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { CheckoutModal } from "@/components/billing/checkout-modal";
import type { SubscriptionPlan, SubscriptionStatus, BillingStatus } from "@prisma/client";
import type { PlanInfo } from "@/lib/plans";

interface BillingInvoiceData {
  id: string;
  invoiceNumber: string;
  plan: SubscriptionPlan;
  amount: number;
  status: BillingStatus;
  tripayPaymentUrl: string | null;
  createdAt: Date;
}

interface TenantData {
  plan: SubscriptionPlan;
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt: Date | null;
  subscriptionEndsAt: Date | null;
}

interface BillingClientProps {
  tenant: TenantData;
  invoices: BillingInvoiceData[];
  plans: PlanInfo[];
}

const statusColor: Record<string, string> = {
  PAID: "bg-green-100 text-green-700",
  PENDING: "bg-yellow-100 text-yellow-700",
  FAILED: "bg-red-100 text-red-700",
  EXPIRED: "bg-gray-100 text-gray-500",
};

export function BillingClient({ tenant, invoices, plans }: BillingClientProps) {
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState<"PRO" | "ENTERPRISE" | null>(null);
  const [checkingId, setCheckingId] = useState<string | null>(null);

  const planByTier = Object.fromEntries(plans.map((p) => [p.tier, p])) as Record<
    SubscriptionPlan,
    PlanInfo
  >;
  const currentPlan = planByTier[tenant.plan];

  async function handleCheckStatus(invoiceId: string) {
    setCheckingId(invoiceId);
    try {
      const res = await fetch(`/api/billing/check-status/${invoiceId}`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Gagal mengecek status.");
        return;
      }

      if (data.status === "PAID") {
        toast.success("Pembayaran berhasil! Paket langganan telah diaktifkan.");
        router.refresh();
      } else if (data.status === "EXPIRED" || data.status === "FAILED") {
        toast.info(`Status: ${data.status}. Silakan buat tagihan baru.`);
        router.refresh();
      } else {
        toast.info("Pembayaran belum diterima. Silakan coba lagi setelah membayar.");
      }
    } catch {
      toast.error("Terjadi kesalahan saat mengecek status.");
    } finally {
      setCheckingId(null);
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Langganan & Billing</h1>
        <p className="text-gray-500 mt-1">Kelola paket langganan toko Anda</p>
      </div>

      {/* Current Plan */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-500 mb-1">Paket Aktif</p>
            <h2 className="text-xl font-bold text-gray-900">{currentPlan.name}</h2>
            {tenant.subscriptionStatus === "TRIAL" && tenant.trialEndsAt && (
              <div className="flex items-center gap-1.5 mt-2 text-orange-600 text-sm">
                <Clock className="w-4 h-4" />
                <span>Trial berakhir: {formatDate(tenant.trialEndsAt)}</span>
              </div>
            )}
            {tenant.subscriptionStatus === "ACTIVE" && tenant.subscriptionEndsAt && (
              <div className="flex items-center gap-1.5 mt-2 text-green-600 text-sm">
                <CheckCircle className="w-4 h-4" />
                <span>Aktif hingga: {formatDate(tenant.subscriptionEndsAt)}</span>
              </div>
            )}
            {tenant.subscriptionStatus === "EXPIRED" && (
              <div className="flex items-center gap-1.5 mt-2 text-red-600 text-sm">
                <AlertCircle className="w-4 h-4" />
                <span>Langganan telah berakhir</span>
              </div>
            )}
          </div>
          <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
            {tenant.subscriptionStatus === "TRIAL" ? "Trial" : tenant.subscriptionStatus}
          </span>
        </div>

        <ul className="mt-4 space-y-1.5">
          {currentPlan.features.map((f) => (
            <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
              <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
              {f}
            </li>
          ))}
        </ul>
      </div>

      {/* Upgrade Plans */}
      <div>
        <h2 className="font-semibold text-gray-900 mb-3">
          {tenant.plan === "FREE" || tenant.plan === "PRO" ? "Upgrade Paket" : "Paket Tersedia"}
        </h2>

        {/* Warning kalau ada langganan aktif */}
        {tenant.subscriptionStatus === "ACTIVE" && tenant.subscriptionEndsAt && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 flex gap-2.5">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">
                Langganan {tenant.plan} aktif hingga {formatDate(tenant.subscriptionEndsAt)}.
              </p>
              <p className="mt-0.5">
                Anda hanya bisa <strong>perpanjang paket {tenant.plan}</strong> saat ini. Untuk pindah ke paket lain, tunggu hingga masa aktif berakhir.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(["PRO", "ENTERPRISE"] as const).map((planKey) => {
            const plan = planByTier[planKey];
            if (!plan || !plan.isActive) return null;
            const isCurrent = tenant.plan === planKey && tenant.subscriptionStatus === "ACTIVE";
            // Tombol di-disable kalau ada langganan aktif untuk plan BERBEDA
            const hasActiveOtherPlan = Boolean(
              tenant.subscriptionStatus === "ACTIVE" &&
                tenant.subscriptionEndsAt &&
                tenant.subscriptionEndsAt > new Date() &&
                tenant.plan !== planKey
            );

            // Label tombol kontekstual
            const buttonLabel = isCurrent
              ? `Perpanjang ${plan.name}`
              : hasActiveOtherPlan
              ? "Tidak Tersedia"
              : `Pilih ${plan.name}`;

            return (
              <div
                key={planKey}
                className={`bg-white rounded-xl border-2 p-5 transition-colors ${
                  isCurrent
                    ? "border-blue-500"
                    : hasActiveOtherPlan
                    ? "border-gray-200 opacity-60"
                    : "border-gray-200 hover:border-blue-400"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-bold text-gray-900">{plan.name}</h3>
                  {isCurrent && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                      Aktif
                    </span>
                  )}
                </div>
                <p className="text-2xl font-bold text-blue-600 mt-1">
                  {formatCurrency(plan.monthlyPrice)}
                  <span className="text-sm font-normal text-gray-500">/bulan</span>
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  atau {formatCurrency(plan.yearlyPrice)}/tahun (hemat 17%)
                </p>
                <ul className="mt-3 space-y-1.5 mb-4">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                      <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => setSelectedPlan(planKey)}
                  disabled={hasActiveOtherPlan}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-2 rounded-lg text-sm transition-colors"
                  title={
                    hasActiveOtherPlan
                      ? `Tunggu langganan ${tenant.plan} berakhir untuk pindah paket`
                      : ""
                  }
                >
                  {buttonLabel}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Invoice History */}
      {invoices.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Riwayat Pembayaran</h2>
          <div className="space-y-2">
            {invoices.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{inv.invoiceNumber}</p>
                  <p className="text-xs text-gray-500">
                    {inv.plan} · {formatDate(inv.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-sm font-semibold text-gray-900">
                    {formatCurrency(inv.amount)}
                  </p>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      statusColor[inv.status] || "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {inv.status}
                  </span>
                  {inv.status === "PENDING" && (
                    <>
                      <button
                        onClick={() => handleCheckStatus(inv.id)}
                        disabled={checkingId === inv.id}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:bg-blue-50 px-2 py-1 rounded-md transition-colors disabled:opacity-50"
                        title="Cek status pembayaran ke Tripay"
                      >
                        {checkingId === inv.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3.5 h-3.5" />
                        )}
                        Cek
                      </button>
                      {inv.tripayPaymentUrl && (
                        <a
                          href={inv.tripayPaymentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-700"
                          title="Lanjutkan pembayaran"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {selectedPlan && (
        <CheckoutModal
          plan={selectedPlan}
          onClose={() => setSelectedPlan(null)}
        />
      )}
    </div>
  );
}
