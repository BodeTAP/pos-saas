import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import { getActiveOutletId } from "@/lib/active-outlet";

/**
 * GET /api/tables/[id]/order
 * Ambil order aktif di meja ini (jika ada).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const outletId = await getActiveOutletId();
    const table = await prisma.table.findFirst({
      where: {
        id,
        tenantId: session.user.tenantId,
        ...(outletId ? { outletId } : {}),
      },
      select: { id: true },
    });
    if (!table) {
      return NextResponse.json({ error: "Meja tidak ditemukan." }, { status: 404 });
    }

    const order = await prisma.tableOrder.findFirst({
      where: { tableId: id, tenantId: session.user.tenantId, closedAt: null },
      include: {
        transaction: {
          select: { id: true, invoiceNumber: true, total: true, status: true },
        },
      },
    });

    return NextResponse.json({ order });
  } catch (error) {
    console.error("Get table order error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/**
 * POST /api/tables/[id]/order
 * Buka order baru di meja (set status OCCUPIED).
 *
 * Race-condition handling: partial unique index "table_orders_one_active_per_table"
 * memastikan hanya 1 active TableOrder per Table. Jika 2 kasir POST bersamaan,
 * yang kedua akan dapat P2002 → return 409 dengan order yang sudah ada.
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

    const outletId = await getActiveOutletId();
    const table = await prisma.table.findFirst({
      where: {
        id,
        tenantId: session.user.tenantId,
        isActive: true,
        ...(outletId ? { outletId } : {}),
      },
      select: { id: true },
    });
    if (!table) {
      return NextResponse.json({ error: "Meja tidak ditemukan." }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const note = typeof body.note === "string" ? body.note.slice(0, 200) : null;

    try {
      const order = await prisma.$transaction(async (tx) => {
        const newOrder = await tx.tableOrder.create({
          data: {
            tableId: id,
            tenantId: session.user.tenantId!,
            note,
          },
        });

        await tx.table.update({
          where: { id },
          data: { status: "OCCUPIED" },
        });

        return newOrder;
      });

      return NextResponse.json({ order }, { status: 201 });
    } catch (err) {
      // P2002 = unique constraint violation (partial unique index)
      // Artinya sudah ada active TableOrder — race condition dengan kasir lain
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const existing = await prisma.tableOrder.findFirst({
          where: { tableId: id, tenantId: session.user.tenantId, closedAt: null },
        });
        return NextResponse.json(
          { error: "Meja sudah memiliki order aktif.", order: existing },
          { status: 409 }
        );
      }
      throw err;
    }
  } catch (error) {
    console.error("Open table order error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/tables/[id]/order
 * Tutup order (batalkan tanpa bayar) — set meja kembali EMPTY.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const outletId = await getActiveOutletId();
    const order = await prisma.tableOrder.findFirst({
      where: {
        tableId: id,
        tenantId: session.user.tenantId,
        closedAt: null,
        ...(outletId ? { table: { outletId } } : {}),
      },
    });
    if (!order) {
      return NextResponse.json({ error: "Tidak ada order aktif di meja ini." }, { status: 404 });
    }

    if (order.transactionId) {
      return NextResponse.json(
        { error: "Order sudah dibayar dan tidak bisa dibatalkan." },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.tableOrder.update({
        where: { id: order.id },
        data: { closedAt: new Date() },
      });
      await tx.table.update({
        where: { id },
        data: { status: "EMPTY" },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Close table order error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
