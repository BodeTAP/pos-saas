import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getTransactionStatus } from "@/lib/tripay";
import { applyBillingStatusUpdate, type TripayStatus } from "@/lib/billing-actions";

/**
 * Manual cek status transaksi ke Tripay (untuk development tanpa webhook).
 * Owner klik tombol "Cek Status" di halaman billing → endpoint ini polling
 * status ke Tripay, lalu update invoice + aktivasi paket kalau sudah PAID.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user.tenantId || session.user.role !== "OWNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Cari invoice milik tenant ini
    const invoice = await prisma.billingInvoice.findFirst({
      where: { id, tenantId: session.user.tenantId },
    });

    if (!invoice) {
      return NextResponse.json(
        { error: "Invoice tidak ditemukan." },
        { status: 404 }
      );
    }

    if (!invoice.tripayReference) {
      return NextResponse.json(
        { error: "Invoice belum terhubung ke Tripay." },
        { status: 400 }
      );
    }

    // Sudah final, tidak perlu cek lagi
    if (invoice.status === "PAID" || invoice.status === "EXPIRED") {
      return NextResponse.json({
        status: invoice.status,
        message: "Status sudah final.",
      });
    }

    // Polling ke Tripay
    const tripayData = await getTransactionStatus(invoice.tripayReference);
    const tripayStatus: TripayStatus = tripayData.status;
    const paidAt = tripayData.paid_at
      ? new Date(tripayData.paid_at * 1000)
      : null;

    const result = await applyBillingStatusUpdate(invoice, tripayStatus, paidAt);

    return NextResponse.json({
      status: result.status,
      updated: result.updated,
      tripayStatus,
    });
  } catch (error) {
    console.error("Check status error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Server error",
      },
      { status: 500 }
    );
  }
}
