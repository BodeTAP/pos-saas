import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { parseBody } from "@/lib/schemas";

const refundSchema = z.object({
  reason: z.string().min(1, "Alasan retur wajib diisi.").max(300),
  restoreStock: z.boolean().default(true),
});

const REFUND_ALREADY_PROCESSED = "REFUND_ALREADY_PROCESSED";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    // Only OWNER can refund
    if (!session?.user.tenantId || session.user.role !== "OWNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const transaction = await prisma.transaction.findFirst({
      where: { id, tenantId: session.user.tenantId, status: "COMPLETED" },
      include: { items: true },
    });

    if (!transaction) {
      return NextResponse.json(
        { error: "Transaksi tidak ditemukan atau tidak bisa diretur." },
        { status: 404 }
      );
    }

    const parsed = await parseBody(req, refundSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }

    const { reason, restoreStock } = parsed.data;

    await prisma.$transaction(async (tx) => {
      // Claim the refund before touching stock or points.
      const refundClaim = await tx.transaction.updateMany({
        where: {
          id,
          tenantId: session.user.tenantId!,
          status: "COMPLETED",
        },
        data: {
          status: "CANCELLED",
          note: transaction.note
            ? `${transaction.note} | RETUR: ${reason}`
            : `RETUR: ${reason}`,
        },
      });
      if (refundClaim.count === 0) {
        throw new Error(REFUND_ALREADY_PROCESSED);
      }

      // Restore stock if requested
      if (restoreStock) {
        for (const item of transaction.items) {
          const restoredStock = await tx.outletStock.upsert({
            where: {
              outletId_productId: {
                outletId: transaction.outletId,
                productId: item.productId,
              },
            },
            update: { stock: { increment: item.quantity } },
            create: {
              stock: item.quantity,
              outletId: transaction.outletId,
              productId: item.productId,
              tenantId: session.user.tenantId!,
            },
            select: { stock: true },
          });

          await tx.stockMutation.create({
            data: {
              type: "RETURN",
              quantity: item.quantity,
              stockBefore: restoredStock.stock - item.quantity,
              stockAfter: restoredStock.stock,
              note: `Retur - ${transaction.invoiceNumber}: ${reason}`,
              tenantId: session.user.tenantId!,
              productId: item.productId,
              outletId: transaction.outletId,
            },
          });
        }
      }

      // Reverse exactly the loyalty delta applied when the transaction was saved.
      if (transaction.customerId) {
        const refundedPointsDelta =
          transaction.pointsRedeemed - transaction.pointsEarned;
        if (refundedPointsDelta !== 0) {
          await tx.customer.update({
            where: { id: transaction.customerId },
            data: { points: { increment: refundedPointsDelta } },
          });
        }
      }
    });

    return NextResponse.json({ success: true, message: "Transaksi berhasil diretur." });
  } catch (error) {
    console.error("Refund error:", error);
    if (error instanceof Error && error.message === REFUND_ALREADY_PROCESSED) {
      return NextResponse.json(
        { error: "Retur transaksi sudah diproses." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memproses retur." },
      { status: 500 }
    );
  }
}
