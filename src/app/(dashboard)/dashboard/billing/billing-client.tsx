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
  ArrowUp,
  ArrowDown,
  X,
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
  scheduledDowngradePlan: SubscriptionPlan | null;
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

const planOrder: Record<string, number> = { FREE: 0, PRO: 1, ENTERPRISE: 2 };

export function BillingClient({ tenant, invoices, plans }: BillingClientProps) {
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState<"PRO" | "ENTERPRISE" | null>(null);
  const [checkoutMode, setCheckoutMode] = useState<"normal" | "upgrade">("normal");
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [showDowngradeModal, setShowDowngradeModal] = useState<"PRO" | "FREE" | null>(null);
  const [isDowngrading, setIsDowngrading] = useState(false);
  const [isCancellingDowngrade, setIsCancellingDowngrade] = useState(false);

  const planByTier = Object.fromEntries(plans.map((p) => [p.tier, p])) as Record<
    SubscriptionPlan,
    PlanInfo
  >;
  const currentPlan = planByTier[tenant.plan];
  const currentOrder = planOrder[tenant.plan] ?? 0;

  const isActive =
    tenant.subscriptionStatus === "ACTIVE" &&
    tenant.subscriptionEndsAt &&
    tenant.subscriptionEndsAt > new Date();

  async function handleCheckStatus(invoiceId: string) {
    setCheckingId(invoiceId);
    try {
      const res = await fetch(`/api/billing/check-status/${invoiceId}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Gagal mengecek status."); return; }
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

  async function handleDowngrade(targetPlan: "PRO" | "FREE") {
    setIsDowngrading(true);
    try {
      const res = await fetch("/api/billing/downgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: targetPlan }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Gagal menjadwalkan downgrade."); return; }

      const planName = planByTier[targetPlan]?.name || targetPlan;
      toast.success(
        `Downgrade ke ${planName} dijadwalkan. Efektif ${formatDate(data.effectiveDate)}.`
      );
      if (data.warnings?.length > 0) {
        data.warnings.forEach((w: string) => toast.info(w, { duration: 8000 }));
      }
      setShowDowngradeModal(null);
      router.refresh();
    } catch {
      toast.error("Terjadi kesalahan koneksi.");
    } finally {
      setIsDowngrading(false);
    }
  }

  async function handleCancelDowngrade() {
    setIsCancellingDowngrade(true);
    try {
      const res = await fetch("/api/billing/downgrade", { method: "DELETE" });
      if (!res.ok) { toast.error("Gagal membatalkan downgrade."); return; }
      toast.success("Jadwal downgrade berhasil dibatalkan.");
      router.refresh();
    } catch {
      toast.error("Terjadi kesalahan koneksi.");
    } finally {
      setIsCancellingDowngrade(false);
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
            <h2 className="text-xl font-bold text-gray-900">{currentPlan?.name}</h2>
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
          {currentPlan?.features.map((f) => (
            <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
              <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
              {f}
            </li>
          ))}
        </ul>
      </div>

      {/* Downgrade terjadwal */}
      {tenant.scheduledDowngradePlan && tenant.subscriptionEndsAt && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <ArrowDown className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-900">
                Downgrade terjadwal ke{" "}
                <strong>{planByTier[tenant.scheduledDowngradePlan]?.name || tenant.scheduledDowngradePlan}</strong>
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                Efektif {formatDate(tenant.subscriptionEndsAt)} — paket saat ini tetap aktif hingga tanggal tersebut.
              </p>
            </div>
          </div>
          <button
            onClick={handleCancelDowngrade}
            disabled={isCancellingDowngrade}
            className="flex items-center gap-1 text-xs text-amber-700 hover:text-amber-900 font-medium flex-shrink-0"
          >
            {isCancellingDowngrade ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <X className="w-3.5 h-3.5" />
            )}
            Batalkan
          </button>
        </div>
      )}

      {/* Plan Cards */}
      <div>
        <h2 className="font-semibold text-gray-900 mb-3">Paket Tersedia</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(["PRO", "ENTERPRISE"] as const).map((planKey) => {
            const plan = planByTier[planKey];
            if (!plan || !plan.isActive) return null;

            const targetOrder = planOrder[planKey] ?? 0;
            const isCurrent = tenant.plan === planKey && tenant.subscriptionStatus === "ACTIVE";
            const isUpgrade = isActive && targetOrder > currentOrder;
            const isDowngrade = isActive && targetOrder < currentOrder;
            const isScheduledDowngrade = tenant.scheduledDowngradePlan === planKey;

            // Tentukan label & aksi tombol
            let primaryLabel = `Pilih ${plan.name}`;
            let primaryAction = () => { setCheckoutMode("normal"); setSelectedPlan(planKey); };
            let primaryDisabled = false;
            let primaryClass = "bg-blue-600 hover:bg-blue-700 text-white";

            if (isCurrent) {
              primaryLabel = `Perpanjang ${plan.name}`;
              primaryAction = () => { setCheckoutMode("normal"); setSelectedPlan(planKey); };
            } else if (isUpgrade) {
              primaryLabel = `Upgrade ke ${plan.name}`;
              primaryAction = () => { setCheckoutMode("upgrade"); setSelectedPlan(planKey); };
              primaryClass = "bg-green-600 hover:bg-green-700 text-white";
            } else if (isDowngrade) {
              if (isScheduledDowngrade) {
                primaryLabel = "Downgrade Dijadwalkan";
                primaryDisabled = true;
                primaryClass = "bg-gray-200 text-gray-500 cursor-not-allowed";
              } else {
                primaryLabel = `Jadwalkan Downgrade`;
                primaryAction = () => setShowDowngradeModal(planKey as "PRO" | "FREE");
                primaryClass = "bg-orange-100 hover:bg-orange-200 text-orange-700 border border-orange-300";
              }
            }

            return (
              <div
                key={planKey}
                className={`bg-white rounded-xl border-2 p-5 transition-colors ${
                  isCurrent ? "border-blue-500" : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-bold text-gray-900">{plan.name}</h3>
                  <div className="flex items-center gap-1.5">
                    {isCurrent && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                        Aktif
                      </span>
                    )}
                    {isUpgrade && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-0.5">
                        <ArrowUp className="w-3 h-3" /> Upgrade
                      </span>
                    )}
                    {isDowngrade && !isScheduledDowngrade && (
                      <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-0.5">
                        <ArrowDown className="w-3 h-3" /> Downgrade
                      </span>
                    )}
                  </div>
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

                {isUpgrade && (
                  <p className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2 mb-3">
                    Paket saat ini langsung berakhir. Paket baru mulai dari sekarang.
                  </p>
                )}
                {isDowngrade && !isScheduledDowngrade && (
                  <p className="text-xs text-orange-700 bg-orange-50 rounded-lg px-3 py-2 mb-3">
                    Paket saat ini tetap aktif hingga {tenant.subscriptionEndsAt ? formatDate(tenant.subscriptionEndsAt) : "masa berakhir"}. Downgrade efektif setelah itu.
                  </p>
                )}

                <button
                  onClick={primaryAction}
                  disabled={primaryDisabled}
                  className={`w-full font-medium py-2 rounded-lg text-sm transition-colors ${primaryClass}`}
                >
                  {primaryLabel}
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
              <div key={inv.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{inv.invoiceNumber}</p>
                  <p className="text-xs text-gray-500">{inv.plan} · {formatDate(inv.createdAt)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-sm font-semibold text-gray-900">{formatCurrency(inv.amount)}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[inv.status] || "bg-gray-100 text-gray-500"}`}>
                    {inv.status}
                  </span>
                  {inv.status === "PENDING" && (
                    <>
                      <button
                        onClick={() => handleCheckStatus(inv.id)}
                        disabled={checkingId === inv.id}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:bg-blue-50 px-2 py-1 rounded-md transition-colors disabled:opacity-50"
                      >
                        {checkingId === inv.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                        Cek
                      </button>
                      {inv.tripayPaymentUrl && (
                        <a href={inv.tripayPaymentUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700">
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
          mode={checkoutMode}
          tenant={{ plan: tenant.plan, subscriptionEndsAt: tenant.subscriptionEndsAt }}
          onClose={() => setSelectedPlan(null)}
          onSuccess={() => { setSelectedPlan(null); router.refresh(); }}
        />
      )}

      {/* Downgrade Confirmation Modal */}
      {showDowngradeModal && (
        <DowngradeConfirmModal
          targetPlan={showDowngradeModal}
          targetPlanName={planByTier[showDowngradeModal]?.name || showDowngradeModal}
          effectiveDate={tenant.subscriptionEndsAt}
          isLoading={isDowngrading}
          onConfirm={() => handleDowngrade(showDowngradeModal)}
          onClose={() => setShowDowngradeModal(null)}
        />
      )}
    </div>
  );
}

function DowngradeConfirmModal({
  targetPlan,
  targetPlanName,
  effectiveDate,
  isLoading,
  onConfirm,
  onClose,
}: {
  targetPlan: string;
  targetPlanName: string;
  effectiveDate: Date | null;
  isLoading: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
            <ArrowDown className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">Jadwalkan Downgrade</h2>
            <p className="text-sm text-gray-500">ke {targetPlanName}</p>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 space-y-2 text-sm text-amber-800">
          <p>
            <strong>Paket saat ini tetap aktif</strong> hingga{" "}
            {effectiveDate ? formatDate(effectiveDate) : "masa berakhir"}.
          </p>
          <p>
            Setelah tanggal tersebut, paket akan otomatis turun ke{" "}
            <strong>{targetPlanName}</strong>. Kamu perlu membeli paket baru untuk melanjutkan.
          </p>
          {targetPlan === "PRO" && (
            <p className="text-orange-700">
              ⚠️ Fitur multi-cabang tidak tersedia di Paket Pro. Pastikan kamu sudah menyesuaikan penggunaan cabang sebelum downgrade efektif.
            </p>
          )}
        </div>

        <p className="text-sm text-gray-600 mb-5">
          Kamu bisa membatalkan jadwal downgrade ini kapan saja sebelum tanggal efektif.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50"
          >
            Batal
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white font-medium py-2.5 rounded-xl flex items-center justify-center gap-2"
          >
            {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Menjadwalkan...</> : "Jadwalkan Downgrade"}
          </button>
        </div>
      </div>
    </div>
  );
}
