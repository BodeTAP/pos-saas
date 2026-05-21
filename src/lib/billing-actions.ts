import { prisma } from "@/lib/prisma";
import { getPlan } from "@/lib/plans";
import type { BillingInvoice } from "@prisma/client";

export type TripayStatus = "PAID" | "EXPIRED" | "FAILED" | "REFUND" | "UNPAID";

function mapStatus(
  tripayStatus: TripayStatus
): "PAID" | "EXPIRED" | "FAILED" | "PENDING" {
  switch (tripayStatus) {
    case "PAID": return "PAID";
    case "EXPIRED": return "EXPIRED";
    case "FAILED":
    case "REFUND": return "FAILED";
    default: return "PENDING";
  }
}

/**
 * Update status invoice & aktivasi paket tenant kalau PAID.
 * Menangani 3 skenario:
 * 1. Perpanjang paket yang sama → extend masa aktif
 * 2. Upgrade ke paket lebih tinggi → paket lama langsung berakhir, paket baru mulai sekarang
 * 3. Checkout baru (trial/expired) → mulai fresh dari periodEnd invoice
 *
 * FIX 2: Atomic idempotency — only update if status hasn't changed yet
 */
export async function applyBillingStatusUpdate(
  invoice: BillingInvoice,
  tripayStatus: TripayStatus,
  paidAt: Date | null
): Promise<{ updated: boolean; status: string }> {
  const newStatus = mapStatus(tripayStatus);

  // Atomic idempotency: only update if status hasn't changed yet
  const updateResult = await prisma.billingInvoice.updateMany({
    where: { id: invoice.id, status: { not: newStatus } },
    data: {
      status: newStatus,
      paidAt: newStatus === "PAID" ? paidAt || new Date() : null,
    },
  });

  if (updateResult.count === 0) {
    return { updated: false, status: newStatus };
  }

  if (newStatus === "PAID") {
    await prisma.$transaction(async (tx) => {
      const planInfo = await getPlan(invoice.plan);

      const tenant = await tx.tenant.findUnique({
        where: { id: invoice.tenantId },
        select: { plan: true, subscriptionEndsAt: true },
      });

      const now = new Date();
      const baseEnd = new Date(invoice.periodEnd);

      // Tentukan skenario
      const planOrder = { FREE: 0, PRO: 1, ENTERPRISE: 2 };
      const currentOrder = planOrder[tenant?.plan as keyof typeof planOrder] ?? 0;
      const newOrder = planOrder[invoice.plan as keyof typeof planOrder] ?? 0;

      const isUpgrade = newOrder > currentOrder;
      const isSamePlanRenewal =
        !isUpgrade &&
        tenant?.plan === invoice.plan &&
        tenant?.subscriptionEndsAt &&
        tenant.subscriptionEndsAt > now;

      if (isSamePlanRenewal) {
        // Perpanjang: tambahkan sisa masa aktif ke period baru
        const remainingMs = tenant.subscriptionEndsAt!.getTime() - now.getTime();
        baseEnd.setTime(baseEnd.getTime() + remainingMs);
      }
      // Upgrade: mulai fresh dari periodEnd invoice (tidak extend sisa Pro)
      // Checkout baru: sama, mulai fresh dari periodEnd invoice

      await tx.tenant.update({
        where: { id: invoice.tenantId },
        data: {
          plan: invoice.plan,
          subscriptionStatus: "ACTIVE",
          subscriptionEndsAt: baseEnd,
          maxProducts: planInfo.maxProducts,
          maxCashiers: planInfo.maxCashiers,
          maxOutlets: planInfo.maxOutlets,
          // Hapus jadwal downgrade kalau ada (upgrade membatalkan downgrade terjadwal)
          scheduledDowngradePlan: null,
        },
      });
    });
  }

  return { updated: true, status: newStatus };
}

/**
 * Terapkan downgrade terjadwal jika sudah waktunya.
 * Dipanggil saat tenant login atau saat cek status subscription.
 * Cek apakah subscriptionEndsAt sudah lewat dan ada scheduledDowngradePlan.
 *
 * FIX 12: Wrapped in prisma.$transaction for atomic read + update
 * FIX 5: FREE plan downgrade sets ACTIVE status, not EXPIRED
 */
export async function applyScheduledDowngradeIfDue(tenantId: string): Promise<boolean> {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.findUnique({
        where: { id: tenantId },
        select: {
          plan: true,
          subscriptionStatus: true,
          subscriptionEndsAt: true,
          scheduledDowngradePlan: true,
        },
      });

      if (
        !tenant?.scheduledDowngradePlan ||
        !tenant.subscriptionEndsAt ||
        tenant.subscriptionEndsAt > new Date()
      ) {
        return false; // Belum waktunya atau tidak ada jadwal
      }

      // Waktunya downgrade
      const targetPlan = tenant.scheduledDowngradePlan;
      const planInfo = await getPlan(targetPlan);

      await tx.tenant.update({
        where: { id: tenantId },
        data: {
          plan: targetPlan,
          // FIX 5: FREE plan is always ACTIVE; paid plans that expired are EXPIRED
          subscriptionStatus: targetPlan === "FREE" ? "ACTIVE" : "EXPIRED",
          subscriptionEndsAt: targetPlan === "FREE" ? null : undefined,
          scheduledDowngradePlan: null,
          maxProducts: planInfo.maxProducts,
          maxCashiers: planInfo.maxCashiers,
          maxOutlets: planInfo.maxOutlets,
        },
      });

      return true;
    });

    return result;
  } catch (error) {
    console.error("applyScheduledDowngradeIfDue error:", error);
    return false; // Don't block login on downgrade errors
  }
}
