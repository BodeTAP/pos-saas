import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { parseBody } from "@/lib/schemas";

const refundSchema = z.object({
  reason: z.string().min(1, "Alasan retur wajib diisi.").max(300),
  restoreStock: z.boolean().default(true),
});

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
      // Mark transaction as CANCELLED
      await tx.transaction.update({
        where: { id },
        data: {
          status: "CANCELLED",
          note: transaction.note
            ? `${transaction.note} | RETUR: ${reason}`
            : `RETUR: ${reason}`,
        },
      });

      // Restore stock if requested
      if (restoreStock) {
        for (const item of transaction.items) {
          const outletStock = await tx.outletStock.findUnique({
            where: {
              outletId_productId: {
                outletId: transaction.outletId,
                productId: item.productId,
              },
            },
          });

          if (outletStock) {
            await tx.outletStock.update({
              where: { id: outletStock.id },
              data: { stock: { increment: item.quantity } },
            });

            await tx.stockMutation.create({
              data: {
                type: "RETURN",
                quantity: item.quantity,
                stockBefore: outletStock.stock,
                stockAfter: outletStock.stock + item.quantity,
                note: `Retur - ${transaction.invoiceNumber}: ${reason}`,
                tenantId: session.user.tenantId!,
                productId: item.productId,
                outletId: transaction.outletId,
              },
            });
          }
        }
      }

      // Reverse customer points if any
      if (transaction.customerId) {
        const tenantConfig = await tx.tenant.findUnique({
          where: { id: session.user.tenantId! },
          select: { pointsPerAmount: true },
        });
        const pointsPerAmount = tenantConfig?.pointsPerAmount || 10000;
        const earnedPoints = Math.floor(transaction.total / pointsPerAmount);

        if (earnedPoints > 0) {
          await tx.customer.update({
            where: { id: transaction.customerId },
            data: { points: { decrement: earnedPoints } },
          });
        }
      }
    });

    return NextResponse.json({ success: true, message: "Transaksi berhasil diretur." });
  } catch (error) {
    console.error("Refund error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memproses retur." },
      { status: 500 }
    );
  }
}
