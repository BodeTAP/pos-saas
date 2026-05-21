import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { parseBody } from "@/lib/schemas";

const closeShiftSchema = z.object({
  closingCash: z.number().nonnegative("Kas akhir tidak boleh negatif."),
  note: z.string().max(300).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const shift = await prisma.cashierShift.findFirst({
      where: {
        id,
        cashierId: session.user.id,
        tenantId: session.user.tenantId,
        status: "OPEN",
      },
    });

    if (!shift) {
      return NextResponse.json(
        { error: "Shift tidak ditemukan atau sudah ditutup." },
        { status: 404 }
      );
    }

    const parsed = await parseBody(req, closeShiftSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }

    // Calculate shift summary from transactions
    const transactions = await prisma.transaction.findMany({
      where: {
        cashierId: session.user.id,
        outletId: shift.outletId,
        tenantId: session.user.tenantId,
        status: "COMPLETED",
        createdAt: { gte: shift.openedAt },
      },
      select: { total: true, paymentMethod: true },
    });

    const totalRevenue = transactions.reduce((sum, tx) => sum + tx.total, 0);
    const totalCash = transactions
      .filter((tx) => tx.paymentMethod === "CASH")
      .reduce((sum, tx) => sum + tx.total, 0);
    const totalNonCash = totalRevenue - totalCash;

    const closedShift = await prisma.cashierShift.update({
      where: { id },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
        closingCash: parsed.data.closingCash,
        note: parsed.data.note ?? shift.note,
        totalTransactions: transactions.length,
        totalRevenue,
        totalCash,
        totalNonCash,
      },
    });

    return NextResponse.json({ shift: closedShift });
  } catch (error) {
    console.error("Close shift error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
