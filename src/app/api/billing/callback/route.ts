import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyCallbackSignature } from "@/lib/tripay";
import { applyBillingStatusUpdate, type TripayStatus } from "@/lib/billing-actions";
import { sendInvoicePaidEmail } from "@/lib/email";

/**
 * Webhook callback dari Tripay
 * Tripay POST ke endpoint ini saat status transaksi berubah (PAID, EXPIRED, FAILED)
 *
 * Header: X-Callback-Signature (HMAC SHA-256 dari raw body)
 * Header: X-Callback-Event (payment_status)
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("X-Callback-Signature") || "";
    const event = req.headers.get("X-Callback-Event");

    if (!verifyCallbackSignature(rawBody, signature)) {
      console.warn("Tripay callback: invalid signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    if (event !== "payment_status") {
      return NextResponse.json({ success: true, ignored: true });
    }

    const payload = JSON.parse(rawBody) as {
      reference: string;
      merchant_ref: string;
      status: TripayStatus;
      paid_at: number | null;
    };

    const invoice = await prisma.billingInvoice.findFirst({
      where: { invoiceNumber: payload.merchant_ref },
    });

    if (!invoice) {
      console.warn(`Invoice not found: ${payload.merchant_ref}`);
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const result = await applyBillingStatusUpdate(
      invoice,
      payload.status,
      payload.paid_at ? new Date(payload.paid_at * 1000) : null
    );

    // Kirim email konfirmasi pembayaran jika PAID dan baru diupdate
    if (result.updated && result.status === "PAID") {
      const tenant = await prisma.tenant.findUnique({
        where: { id: invoice.tenantId },
        select: { name: true, email: true, plan: true, subscriptionEndsAt: true },
      });
      if (tenant) {
        const { getPlan } = await import("@/lib/plans");
        const planInfo = await getPlan(invoice.plan);
        sendInvoicePaidEmail({
          to: tenant.email,
          ownerName: tenant.name,
          storeName: tenant.name,
          invoiceNumber: invoice.invoiceNumber,
          planName: planInfo.name,
          amount: invoice.amount,
          periodEnd: invoice.periodEnd,
        }).catch((err) => console.error("Invoice paid email error:", err));
      }
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Tripay callback error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
