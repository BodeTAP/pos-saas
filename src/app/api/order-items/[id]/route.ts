import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { OrderItemStatus } from "@prisma/client";
import { getActiveOutletId } from "@/lib/active-outlet";
import { notifyItemReady } from "@/lib/notifications";

const STATUS_TIMESTAMPS: Partial<Record<OrderItemStatus, string>> = {
  COOKING: "cookedAt",
  READY: "readyAt",
  SERVED: "servedAt",
};

/**
 * PATCH /api/order-items/[id]
 * Update status order item.
 * Body: { status: OrderItemStatus }
 *
 * Flow: PENDING → COOKING → READY → SERVED
 * Bisa juga CANCELLED dari status apapun (kecuali SERVED).
 */
export async function PATCH(
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

    // Validasi item milik tenant ini + outlet aktif (cegah cross-outlet leak)
    // Item bisa di TableOrder (dine-in via table.outletId) atau Transaction (takeaway via transaction.outletId)
    const item = await prisma.orderItem.findFirst({
      where: {
        id,
        tenantId: session.user.tenantId,
        ...(outletId
          ? {
              OR: [
                { tableOrder: { table: { outletId } } },
                { transaction: { outletId } },
              ],
            }
          : {}),
      },
      select: { id: true, status: true, tableOrderId: true, transactionId: true },
    });

    if (!item) {
      return NextResponse.json({ error: "Item tidak ditemukan." }, { status: 404 });
    }

    if (item.status === "SERVED") {
      return NextResponse.json(
        { error: "Item sudah disajikan, tidak bisa diubah." },
        { status: 400 }
      );
    }

    const { status } = await req.json() as { status: OrderItemStatus };
    const validStatuses: OrderItemStatus[] = ["PENDING", "COOKING", "READY", "SERVED", "CANCELLED"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "Status tidak valid." }, { status: 400 });
    }

    // Set timestamp sesuai status baru
    const timestampField = STATUS_TIMESTAMPS[status];
    const updateData: Record<string, unknown> = { status };
    if (timestampField) {
      updateData[timestampField] = new Date();
    }

    const updated = await prisma.orderItem.update({
      where: { id },
      data: updateData,
      include: { modifiers: true },
    });

    // Trigger notifikasi saat item siap disajikan (READY)
    if (status === "READY") {
      // Ambil info meja / invoice untuk pesan notifikasi
      const ctx = await prisma.orderItem.findUnique({
        where: { id },
        select: {
          productName: true,
          quantity: true,
          tableOrder: { select: { table: { select: { number: true } } } },
          transaction: { select: { invoiceNumber: true } },
        },
      });
      if (ctx) {
        notifyItemReady(session.user.tenantId, {
          itemName: ctx.productName,
          quantity: ctx.quantity,
          tableNumber: ctx.tableOrder?.table.number ?? null,
          invoiceNumber: ctx.transaction?.invoiceNumber ?? null,
        });
      }
    }

    // Jika status diubah ke SERVED, cek apakah semua item di order sudah SERVED/CANCELLED
    // Hanya auto-close TableOrder yang SUDAH DIBAYAR (PAY_FIRST) — biarkan PAY_LATER tunggu kasir
    if (status === "SERVED" && updated.tableOrderId) {
      const allItems = await prisma.orderItem.findMany({
        where: { tableOrderId: updated.tableOrderId },
        select: { status: true },
      });
      const allDone = allItems.every(
        (i) => i.status === "SERVED" || i.status === "CANCELLED"
      );

      if (allDone) {
        const tableOrder = await prisma.tableOrder.findUnique({
          where: { id: updated.tableOrderId },
          select: { id: true, tableId: true, closedAt: true, transactionId: true },
        });
        // Hanya close jika belum di-close DAN sudah dibayar (transactionId != null)
        // Kalau belum dibayar (PAY_LATER), biarkan terbuka — kasir harus minta bill dulu
        if (tableOrder && !tableOrder.closedAt && tableOrder.transactionId) {
          await prisma.$transaction([
            prisma.tableOrder.update({
              where: { id: tableOrder.id },
              data: { closedAt: new Date() },
            }),
            prisma.table.update({
              where: { id: tableOrder.tableId },
              data: { status: "EMPTY" },
            }),
          ]);
        }
      }
    }

    return NextResponse.json({ item: updated });
  } catch (error) {
    console.error("Update order item status error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/order-items/[id]
 * Hapus order item (hanya jika masih PENDING).
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
    const item = await prisma.orderItem.findFirst({
      where: {
        id,
        tenantId: session.user.tenantId,
        ...(outletId
          ? {
              OR: [
                { tableOrder: { table: { outletId } } },
                { transaction: { outletId } },
              ],
            }
          : {}),
      },
      select: { id: true, status: true },
    });

    if (!item) {
      return NextResponse.json({ error: "Item tidak ditemukan." }, { status: 404 });
    }

    if (item.status !== "PENDING") {
      return NextResponse.json(
        { error: "Hanya item dengan status PENDING yang bisa dihapus." },
        { status: 400 }
      );
    }

    await prisma.orderItem.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete order item error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
