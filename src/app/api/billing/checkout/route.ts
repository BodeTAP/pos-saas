import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createTransaction } from "@/lib/tripay";
import { getPlan, type UpgradablePlan } from "@/lib/plans";
import { generateInvoiceNumber } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user.tenantId || session.user.role !== "OWNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const {
      plan,
      period, // "MONTHLY" | "YEARLY"
      paymentMethod, // kode channel Tripay: BRIVA, QRIS, dll
    } = body as {
      plan: UpgradablePlan;
      period: "MONTHLY" | "YEARLY";
      paymentMethod: string;
    };

    if (!plan || (plan !== "PRO" && plan !== "ENTERPRISE")) {
      return NextResponse.json(
        { error: "Paket tidak valid." },
        { status: 400 }
      );
    }

    if (!paymentMethod) {
      return NextResponse.json(
        { error: "Pilih metode pembayaran terlebih dahulu." },
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
      const endDate = tenant.subscriptionEndsAt!.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
      return NextResponse.json(
        {
          error: `Anda masih memiliki langganan ${tenant.plan} aktif hingga ${endDate}. Tunggu hingga masa aktif berakhir untuk berpindah ke paket ${plan}, atau perpanjang paket ${tenant.plan} terlebih dahulu.`,
        },
        { status: 400 }
      );
    }

    // Cek invoice PENDING yang belum dibayar untuk paket berbeda
    const pendingDifferentPlan = await prisma.billingInvoice.findFirst({
      where: {
        tenantId: session.user.tenantId,
        status: "PENDING",
        plan: { not: plan },
      },
    });

    if (pendingDifferentPlan) {
      return NextResponse.json(
        {
          error: `Anda masih memiliki tagihan ${pendingDifferentPlan.plan} yang belum dibayar (${pendingDifferentPlan.invoiceNumber}). Selesaikan atau biarkan tagihan tersebut kedaluwarsa terlebih dahulu.`,
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
