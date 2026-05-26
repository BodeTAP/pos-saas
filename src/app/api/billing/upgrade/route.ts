import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createTransaction } from "@/lib/tripay";
import { getPlan } from "@/lib/plans";
import { generateInvoiceNumber } from "@/lib/utils";
import { parseBody, checkoutSchema } from "@/lib/schemas";
import { rateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";

const UPGRADE_RATE_LIMIT = { limit: 5, windowSec: 60 * 60 };

/**
 * Upgrade paket langsung (misal Pro → Enterprise).
 * Paket lama langsung berakhir, paket baru mulai dari sekarang.
 * User membayar harga penuh paket baru.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user.tenantId || session.user.role !== "OWNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const ip = getClientIp(req);
    const rl = rateLimit(`billing-upgrade:ip:${ip}`, UPGRADE_RATE_LIMIT);
    if (!rl.success) {
      return rateLimitResponse(rl.resetIn, "Terlalu banyak percobaan upgrade. Coba lagi nanti.");
    }

    const parsed = await parseBody(req, checkoutSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }
    const { plan, period, paymentMethod } = parsed.data;

    const tenant = await prisma.tenant.findUnique({
      where: { id: session.user.tenantId },
      select: {
        name: true,
        email: true,
        phone: true,
        plan: true,
        subscriptionStatus: true,
        subscriptionEndsAt: true,
      },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Tenant tidak ditemukan." }, { status: 404 });
    }

    // Validasi: hanya boleh upgrade ke paket yang lebih tinggi
    const planOrder = { FREE: 0, PRO: 1, ENTERPRISE: 2 };
    const currentOrder = planOrder[tenant.plan as keyof typeof planOrder] ?? 0;
    const targetOrder = planOrder[plan] ?? 0;

    if (targetOrder <= currentOrder) {
      return NextResponse.json(
        { error: "Gunakan fitur downgrade untuk pindah ke paket lebih rendah." },
        { status: 400 }
      );
    }

    // Harus ada langganan aktif untuk upgrade
    const isActive =
      tenant.subscriptionStatus === "ACTIVE" &&
      tenant.subscriptionEndsAt &&
      tenant.subscriptionEndsAt > new Date();

    if (!isActive) {
      return NextResponse.json(
        { error: "Tidak ada langganan aktif. Gunakan checkout biasa." },
        { status: 400 }
      );
    }

    const planInfo = await getPlan(plan);
    if (!planInfo.isActive) {
      return NextResponse.json(
        { error: `Paket ${planInfo.name} sedang tidak tersedia.` },
        { status: 400 }
      );
    }

    const amount = period === "YEARLY" ? planInfo.yearlyPrice : planInfo.monthlyPrice;

    // FIX 6: Cancel any existing PENDING invoices to prevent plan regression
    await prisma.billingInvoice.updateMany({
      where: { tenantId: session.user.tenantId, status: "PENDING" },
      data: { status: "FAILED" },
    });

    // Hitung period end baru (mulai dari sekarang)
    const periodStart = new Date();
    const periodEnd = new Date();
    if (period === "YEARLY") periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    else periodEnd.setMonth(periodEnd.getMonth() + 1);

    // Generate invoice number unik dengan retry loop
    let invoiceNumber = "";
    let invoice = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      invoiceNumber = generateInvoiceNumber("UPG");
      try {
        invoice = await prisma.billingInvoice.create({
          data: {
            invoiceNumber,
            plan,
            amount,
            status: "PENDING",
            periodStart,
            periodEnd,
            tenantId: session.user.tenantId,
          },
        });
        break;
      } catch (err: unknown) {
        const isUniqueViolation =
          err &&
          typeof err === "object" &&
          "code" in err &&
          (err as { code: string }).code === "P2002";
        if (!isUniqueViolation || attempt === 2) throw err;
      }
    }
    if (!invoice) throw new Error("Gagal membuat nomor invoice unik.");

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const periodLabel = period === "YEARLY" ? "Tahunan" : "Bulanan";

    try {
      const tripayTx = await createTransaction({
        method: paymentMethod,
        merchantRef: invoiceNumber,
        amount,
        customerName: tenant.name,
        customerEmail: tenant.email,
        customerPhone: tenant.phone || undefined,
        orderItems: [
          {
            sku: `UPGRADE-${plan}-${period}`,
            name: `Upgrade ke ${planInfo.name} (${periodLabel})`,
            price: amount,
            quantity: 1,
          },
        ],
        callbackUrl: `${appUrl}/api/billing/callback`,
        returnUrl: `${appUrl}/dashboard/billing?invoice=${invoiceNumber}`,
        expiredHours: 24,
      });

      await prisma.billingInvoice.update({
        where: { id: invoice.id },
        data: {
          tripayReference: tripayTx.reference,
          tripayPaymentUrl: tripayTx.checkout_url,
          tripayChannel: paymentMethod,
        },
      });

      return NextResponse.json({
        invoice: { ...invoice, id: invoice.id },
        checkoutUrl: tripayTx.checkout_url,
        payCode: tripayTx.pay_code,
        qrUrl: tripayTx.qr_url,
        reference: tripayTx.reference,
        // Flag untuk billing-actions: ini adalah upgrade, paket lama langsung berakhir
        isUpgrade: true,
      });
    } catch (tripayError) {
      await prisma.billingInvoice.update({
        where: { id: invoice.id },
        data: { status: "FAILED" },
      });
      throw tripayError;
    }
  } catch (error) {
    console.error("Upgrade error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memproses upgrade." },
      { status: 500 }
    );
  }
}
