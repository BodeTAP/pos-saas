import { prisma } from "@/lib/prisma";
import { getPlan } from "@/lib/plans";
import type { BillingInvoice } from "@prisma/client";

export type TripayStatus = "PAID" | "EXPIRED" | "FAILED" | "REFUND" | "UNPAID";

/**
 * Map status Tripay ke status BillingInvoice di database
 */
function mapStatus(
  tripayStatus: TripayStatus
): "PAID" | "EXPIRED" | "FAILED" | "PENDING" {
  switch (tripayStatus) {
    case "PAID":
      return "PAID";
    case "EXPIRED":
      return "EXPIRED";
    case "FAILED":
    case "REFUND":
      return "FAILED";
    default:
      return "PENDING";
  }
}

/**
 * Update status invoice & aktivasi paket tenant kalau PAID.
 * Idempotent: aman dipanggil berkali-kali untuk invoice yang sama.
 *
 * Dipakai oleh:
 * - Webhook callback Tripay (POST /api/billing/callback)
 * - Manual check status (POST /api/billing/check-status)
 *
 * @returns invoice yang sudah di-update
 */
export async function applyBillingStatusUpdate(
  invoice: BillingInvoice,
  tripayStatus: TripayStatus,
  paidAt: Date | null
): Promise<{ updated: boolean; status: string }> {
  const newStatus = mapStatus(tripayStatus);

  // Idempotency — skip kalau invoice sudah PAID & status barunya juga PAID
  if (invoice.status === newStatus) {
    return { updated: false, status: newStatus };
  }

  await prisma.$transaction(async (tx) => {
    await tx.billingInvoice.update({
      where: { id: invoice.id },
      data: {
        status: newStatus,
        paidAt: newStatus === "PAID" ? paidAt || new Date() : null,
      },
    });

    if (newStatus === "PAID") {
      const planInfo = await getPlan(invoice.plan);

      const tenant = await tx.tenant.findUnique({
        where: { id: invoice.tenantId },
        select: { plan: true, subscriptionEndsAt: true },
      });

      const now = new Date();
      const baseEnd = new Date(invoice.periodEnd);

      // Extend masa aktif HANYA jika plan yang dibeli SAMA dengan plan aktif sekarang
      // Jika plan berbeda, mulai fresh dari periodEnd invoice (tanpa nambah sisa)
      const isSamePlanRenewal =
        tenant?.plan === invoice.plan &&
        tenant?.subscriptionEndsAt &&
        tenant.subscriptionEndsAt > now;

      if (isSamePlanRenewal) {
        const remainingMs =
          tenant.subscriptionEndsAt!.getTime() - now.getTime();
        baseEnd.setTime(baseEnd.getTime() + remainingMs);
      }

      await tx.tenant.update({
        where: { id: invoice.tenantId },
        data: {
          plan: invoice.plan,
          subscriptionStatus: "ACTIVE",
          subscriptionEndsAt: baseEnd,
          maxProducts: planInfo.maxProducts,
          maxCashiers: planInfo.maxCashiers,
          maxOutlets: planInfo.maxOutlets,
        },
      });
    }
  });

  return { updated: true, status: newStatus };
}
