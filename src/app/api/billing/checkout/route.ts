import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createTransaction } from "@/lib/tripay";
import { getPlan } from "@/lib/plans";
import { generateInvoiceNumber } from "@/lib/utils";
import { parseBody, checkoutSchema } from "@/lib/schemas";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user.tenantId || session.user.role !== "OWNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const parsed = await parseBody(req, checkoutSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }
    const { plan, period, paymentMethod } = parsed.data;

    const planInfo = await getPlan(plan);
    if (!planInfo.isActive) {
      return NextResponse.json(
        { error: `Paket ${planInfo.name} sedang tidak tersedia.` },
        { status: 400 }
      );
    }
    const amount =
      period === "YEARLY" ? planInfo.yearlyPrice : planInfo.monthlyPrice;

    // Tenant info untuk customer detail Tripay
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

    // Validasi: blokir beli paket berbeda saat masih ada langganan aktif
    const isActive =
      tenant.subscriptionStatus === "ACTIVE" &&
      tenant.subscriptionEndsAt &&
      tenant.subscriptionEndsAt > new Date();

    if (isActive && tenant.plan !== plan) {
      const planOrder = { FREE: 0, PRO: 1, ENTERPRISE: 2 };
      const currentOrder = planOrder[tenant.plan as keyof typeof planOrder] ?? 0;
      const targetOrder = planOrder[plan] ?? 0;

      if (targetOrder > currentOrder) {
        return NextResponse.json(
          { error: "Gunakan fitur upgrade untuk pindah ke paket lebih tinggi." },
          { status: 400 }
        );
      } else {
        return NextResponse.json(
          { error: "Gunakan fitur downgrade untuk pindah ke paket lebih rendah." },
          { status: 400 }
        );
      }
    }

    // FIX 7: Cek invoice PENDING yang belum dibayar (untuk plan apapun)
    const existingPending = await prisma.billingInvoice.findFirst({
      where: {
        tenantId: session.user.tenantId,
        status: "PENDING",
      },
    });

    if (existingPending) {
      return NextResponse.json(
        {
          error: `Anda masih memiliki tagihan ${existingPending.plan} yang belum dibayar (${existingPending.invoiceNumber}). Selesaikan atau tunggu tagihan tersebut kedaluwarsa.`,
        },
        { status: 400 }
      );
    }

    // Generate invoice number unik
    const invoiceNumber = generateInvoiceNumber("BIL");

    // Hitung period start & end
    const periodStart = new Date();
    const periodEnd = new Date();
    if (period === "YEARLY") {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    // Buat invoice di database dulu (status PENDING)
    const invoice = await prisma.billingInvoice.create({
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

    // Buat transaksi di Tripay
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
            sku: `${plan}-${period}`,
            name: `${planInfo.name} (${periodLabel})`,
            price: amount,
            quantity: 1,
          },
        ],
        callbackUrl: `${appUrl}/api/billing/callback`,
        returnUrl: `${appUrl}/dashboard/billing?invoice=${invoiceNumber}`,
        expiredHours: 24,
      });

      // Update invoice dengan data Tripay
      const updatedInvoice = await prisma.billingInvoice.update({
        where: { id: invoice.id },
        data: {
          tripayReference: tripayTx.reference,
          tripayPaymentUrl: tripayTx.checkout_url,
          tripayChannel: paymentMethod,
        },
      });

      return NextResponse.json({
        invoice: updatedInvoice,
        checkoutUrl: tripayTx.checkout_url,
        payCode: tripayTx.pay_code,
        qrUrl: tripayTx.qr_url,
        reference: tripayTx.reference,
      });
    } catch (tripayError) {
      // Rollback invoice jika gagal di Tripay
      await prisma.billingInvoice.update({
        where: { id: invoice.id },
        data: { status: "FAILED" },
      });
      throw tripayError;
    }
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Gagal memproses pembayaran.",
      },
      { status: 500 }
    );
  }
}
