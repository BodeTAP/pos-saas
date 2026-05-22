import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { parseBody } from "@/lib/schemas";
import { z } from "zod";

const receiveSchema = z.object({
  items: z
    .array(
      z.object({
        itemId: z.string().min(1, "ID item tidak valid."),
        quantityReceived: z.number().int().positive("Jumlah diterima harus lebih dari 0."),
        buyPrice: z.number().nonnegative().optional(),
      })
    )
    .min(1, "Minimal 1 item harus diterima."),
  note: z.string().max(300).optional().nullable(),
});

/**
 * POST /api/purchase-orders/[id]/receive
 * Catat penerimaan barang dari PO.
 * - Update quantityReceived per item
 * - Update OutletStock (tambah stok)
 * - Catat StockMutation type PURCHASE
 * - Update status PO (PARTIAL / RECEIVED)
 * - Update buyPrice produk jika berubah
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

    const order = await prisma.purchaseOrder.findFirst({
      where: { id, tenantId: session.user.tenantId },
      include: { items: true },
    });

    if (!order) {
      return NextResponse.json({ error: "PO tidak ditemukan." }, { status: 404 });
    }
    if (order.status === "RECEIVED" || order.status === "CANCELLED") {
      return NextResponse.json(
        { error: "PO ini sudah selesai atau dibatalkan." },
        { status: 400 }
      );
    }

    const parsed = await parseBody(req, receiveSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }

    const { items: receiveItems, note } = parsed.data;

    // Validasi semua itemId milik PO ini
    const itemMap = new Map(order.items.map((i) => [i.id, i]));
    for (const ri of receiveItems) {
      if (!itemMap.has(ri.itemId)) {
        return NextResponse.json(
          { error: `Item ${ri.itemId} tidak ditemukan dalam PO ini.` },
          { status: 400 }
        );
      }
      const poItem = itemMap.get(ri.itemId)!;
      const remaining = poItem.quantity - poItem.quantityReceived;
      if (ri.quantityReceived > remaining) {
        return NextResponse.json(
          {
            error: `${poItem.productName}: jumlah diterima (${ri.quantityReceived}) melebihi sisa pesanan (${remaining}).`,
          },
          { status: 400 }
        );
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const receivedItemIds: string[] = [];

      for (const ri of receiveItems) {
        const poItem = itemMap.get(ri.itemId)!;
        const effectiveBuyPrice = ri.buyPrice ?? poItem.buyPrice;

        // 1. Update quantityReceived di PO item
        await tx.purchaseOrderItem.update({
          where: { id: ri.itemId },
          data: {
            quantityReceived: { increment: ri.quantityReceived },
            ...(ri.buyPrice !== undefined && { buyPrice: ri.buyPrice }),
          },
        });

        // 2. Update OutletStock — tambah stok
        const outletStock = await tx.outletStock.upsert({
          where: {
            outletId_productId: {
              outletId: order.outletId,
              productId: poItem.productId,
            },
          },
          update: { stock: { increment: ri.quantityReceived } },
          create: {
            outletId: order.outletId,
            productId: poItem.productId,
            tenantId: session.user.tenantId!,
            stock: ri.quantityReceived,
            minStock: 5,
          },
          select: { stock: true },
        });

        const stockBefore = outletStock.stock - ri.quantityReceived;

        // 3. Catat StockMutation type PURCHASE
        await tx.stockMutation.create({
          data: {
            type: "PURCHASE",
            quantity: ri.quantityReceived,
            stockBefore,
            stockAfter: outletStock.stock,
            note: note
              ? `PO ${order.poNumber}: ${note}`
              : `Penerimaan PO ${order.poNumber}`,
            tenantId: session.user.tenantId!,
            productId: poItem.productId,
            outletId: order.outletId,
          },
        });

        // 4. Update buyPrice produk jika harga beli berubah
        if (ri.buyPrice !== undefined && ri.buyPrice !== poItem.buyPrice) {
          await tx.product.update({
            where: { id: poItem.productId },
            data: { buyPrice: ri.buyPrice },
          });
        }

        receivedItemIds.push(ri.itemId);
      }

      // 5. Hitung status PO baru
      // Re-fetch items setelah update
      const updatedItems = await tx.purchaseOrderItem.findMany({
        where: { purchaseOrderId: id },
        select: { quantity: true, quantityReceived: true },
      });

      const allReceived = updatedItems.every(
        (item) => item.quantityReceived >= item.quantity
      );
      const anyReceived = updatedItems.some((item) => item.quantityReceived > 0);

      const newStatus = allReceived
        ? "RECEIVED"
        : anyReceived
        ? "PARTIAL"
        : order.status;

      const updatedOrder = await tx.purchaseOrder.update({
        where: { id },
        data: {
          status: newStatus,
          ...(allReceived && { receivedAt: new Date() }),
        },
        include: {
          outlet: { select: { name: true } },
          items: { include: { product: { select: { name: true, unit: true } } } },
        },
      });

      return updatedOrder;
    });

    return NextResponse.json({ order: result });
  } catch (error) {
    console.error("Receive PO error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
