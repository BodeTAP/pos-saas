import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getActiveOutletId } from "@/lib/active-outlet";

const moveSchema = z.object({
  targetTableId: z.string().cuid(),
});

/**
 * POST /api/table-orders/[id]/move
 * Pindahkan TableOrder ke meja lain.
 *
 * Constraint:
 * - Meja tujuan harus EMPTY (atau RESERVED — auto-jadi OCCUPIED)
 * - Meja tujuan harus di outlet yang sama
 * - Meja sumber jadi EMPTY setelah pindah
 * - Race-safe: pakai partial unique index "table_orders_one_active_per_table"
 */
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

    const body = await req.json();
    const parsed = moveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Data tidak valid." }, { status: 400 });
    }
    const { targetTableId } = parsed.data;

    const outletId = await getActiveOutletId();

    // Ambil order existing — filter juga outlet aktif (cegah cross-outlet leak)
    const order = await prisma.tableOrder.findFirst({
      where: {
        id,
        tenantId: session.user.tenantId,
        closedAt: null,
        ...(outletId ? { table: { outletId } } : {}),
      },
      include: {
        table: { select: { id: true, outletId: true, status: true } },
      },
    });
    if (!order) {
      return NextResponse.json({ error: "Order tidak ditemukan atau sudah ditutup." }, { status: 404 });
    }

    if (order.tableId === targetTableId) {
      return NextResponse.json({ error: "Meja tujuan sama dengan meja saat ini." }, { status: 400 });
    }

    // Validasi meja tujuan
    const targetTable = await prisma.table.findFirst({
      where: {
        id: targetTableId,
        tenantId: session.user.tenantId,
        isActive: true,
        ...(outletId ? { outletId } : {}),
      },
      select: { id: true, outletId: true, status: true, number: true },
    });
    if (!targetTable) {
      return NextResponse.json({ error: "Meja tujuan tidak ditemukan." }, { status: 404 });
    }
    if (targetTable.outletId !== order.table.outletId) {
      return NextResponse.json(
        { error: "Tidak bisa pindah ke meja di cabang berbeda." },
        { status: 400 }
      );
    }
    if (targetTable.status !== "EMPTY") {
      const reasonByStatus: Partial<Record<typeof targetTable.status, string>> = {
        OCCUPIED: "Meja tujuan sedang digunakan.",
        BILL: "Meja tujuan sedang menunggu pembayaran.",
        RESERVED: "Meja tujuan sudah dipesan (reservasi). Pilih meja lain.",
      };
      return NextResponse.json(
        { error: reasonByStatus[targetTable.status] || "Meja tujuan tidak kosong." },
        { status: 409 }
      );
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Update TableOrder.tableId
        const moved = await tx.tableOrder.update({
          where: { id },
          data: { tableId: targetTableId },
        });
        // Tujuan jadi OCCUPIED (atau BILL kalau order sudah minta bill)
        await tx.table.update({
          where: { id: targetTableId },
          data: { status: order.table.status === "BILL" ? "BILL" : "OCCUPIED" },
        });
        // Sumber jadi EMPTY
        await tx.table.update({
          where: { id: order.tableId },
          data: { status: "EMPTY" },
        });
        return moved;
      });

      return NextResponse.json({
        order: result,
        message: `Order berhasil dipindahkan ke meja #${targetTable.number}.`,
      });
    } catch (err) {
      // P2002 = unique violation pada "table_orders_one_active_per_table"
      // Artinya meja tujuan sudah punya active order (race condition)
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return NextResponse.json(
          { error: "Meja tujuan sudah memiliki order aktif. Refresh halaman." },
          { status: 409 }
        );
      }
      throw err;
    }
  } catch (error) {
    console.error("Move table order error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
