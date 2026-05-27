import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { OrderItemStatus } from "@prisma/client";

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

    // Validasi item milik tenant ini
    const item = await prisma.orderItem.findFirst({
      where: {
        id,
        tableOrder: { tenantId: session.user.tenantId },
      },
      select: { id: true, status: true },
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

    const item = await prisma.orderItem.findFirst({
      where: {
        id,
        tableOrder: { tenantId: session.user.tenantId },
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
