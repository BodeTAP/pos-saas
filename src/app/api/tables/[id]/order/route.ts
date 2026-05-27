import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

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

    const table = await prisma.table.findFirst({
      where: { id, tenantId: session.user.tenantId },
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

    const table = await prisma.table.findFirst({
      where: { id, tenantId: session.user.tenantId, isActive: true },
      include: { tableOrders: { where: { closedAt: null }, take: 1 } },
    });
    if (!table) {
      return NextResponse.json({ error: "Meja tidak ditemukan." }, { status: 404 });
    }

    if (table.tableOrders.length > 0) {
      return NextResponse.json(
        { error: "Meja sudah memiliki order aktif.", order: table.tableOrders[0] },
        { status: 409 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const note = typeof body.note === "string" ? body.note.slice(0, 200) : null;

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

    const order = await prisma.tableOrder.findFirst({
      where: { tableId: id, tenantId: session.user.tenantId, closedAt: null },
    });
    if (!order) {
      return NextResponse.json({ error: "Tidak ada order aktif di meja ini." }, { status: 404 });
    }

    if (order.transactionId) {
      return NextResponse.json(
        { error: "Order sudah terhubung ke transaksi. Gunakan fitur retur jika perlu." },
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
