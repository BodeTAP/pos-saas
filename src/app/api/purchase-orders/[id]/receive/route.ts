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
 * - Update OutletStock / OutletStockVariant (tambah stok)
 * - Catat StockMutation / StockMutationVariant type PURCHASE
 * - Update status PO (PARTIAL / RECEIVED)
 * - Update buyPrice produk / ProductVariantSKU jika berubah
 * - Recalculate totalCost dari updated items (BUG 15)
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
      for (const ri of receiveItems) {
        const poItem = itemMap.get(ri.itemId)!;
        const effectiveBuyPrice = ri.buyPrice ?? poItem.buyPrice;
        const isVariant = !!poItem.variantSkuId;

        // 1. Update quantityReceived di PO item
        await tx.purchaseOrderItem.update({
          where: { id: ri.itemId },
          data: {
            quantityReceived: { increment: ri.quantityReceived },
            ...(ri.buyPrice !== undefined && { buyPrice: ri.buyPrice }),
          },
        });

        if (isVariant) {
          // ── VARIANT PATH ──────────────────────────────────────────────

          // BUG 2: read current stock BEFORE update to get accurate stockBefore
          const existingVariantStock = await tx.outletStockVariant.findUnique({
            where: {
              outletId_skuId: {
                outletId: order.outletId,
                skuId: poItem.variantSkuId!,
              },
            },
            select: { stock: true },
          });
          const stockBefore = existingVariantStock?.stock ?? 0;
          const stockAfter = stockBefore + ri.quantityReceived;

          // BUG 3: update OutletStockVariant instead of OutletStock
          if (existingVariantStock) {
            await tx.outletStockVariant.update({
              where: {
                outletId_skuId: {
                  outletId: order.outletId,
                  skuId: poItem.variantSkuId!,
                },
              },
              data: { stock: stockAfter },
            });
          } else {
            await tx.outletStockVariant.create({
              data: {
                outletId: order.outletId,
                skuId: poItem.variantSkuId!,
                tenantId: session.user.tenantId!,
                stock: stockAfter,
                minStock: 5,
              },
            });
          }

          // BUG 3: create StockMutationVariant instead of StockMutation
          await tx.stockMutationVariant.create({
            data: {
              type: "PURCHASE",
              quantity: ri.quantityReceived,
              stockBefore,
              stockAfter,
              note: note
                ? `PO ${order.poNumber}: ${note}`
                : `Penerimaan PO ${order.poNumber}`,
              tenantId: session.user.tenantId!,
              skuId: poItem.variantSkuId!,
              outletId: order.outletId,
            },
          });

          // BUG 4: update ProductVariantSKU.buyPrice when variantSkuId is set
          if (ri.buyPrice !== undefined && ri.buyPrice !== poItem.buyPrice) {
            await tx.productVariantSKU.update({
              where: { id: poItem.variantSkuId! },
              data: { buyPrice: effectiveBuyPrice },
            });
          }
        } else {
          // ── BASE PRODUCT PATH ─────────────────────────────────────────

          // BUG 2: read current stock BEFORE update to get accurate stockBefore
          const existingStock = await tx.outletStock.findUnique({
            where: {
              outletId_productId: {
                outletId: order.outletId,
                productId: poItem.productId,
              },
            },
            select: { stock: true },
          });
          const stockBefore = existingStock?.stock ?? 0;
          const stockAfter = stockBefore + ri.quantityReceived;

          // BUG 2: use update/create separately instead of upsert so stockBefore is always accurate
          if (existingStock) {
            await tx.outletStock.update({
              where: {
                outletId_productId: {
                  outletId: order.outletId,
                  productId: poItem.productId,
                },
              },
              data: { stock: stockAfter },
            });
          } else {
            await tx.outletStock.create({
              data: {
                outletId: order.outletId,
                productId: poItem.productId,
                tenantId: session.user.tenantId!,
                stock: stockAfter,
                minStock: 5,
              },
            });
          }

          // Catat StockMutation type PURCHASE
          await tx.stockMutation.create({
            data: {
              type: "PURCHASE",
              quantity: ri.quantityReceived,
              stockBefore,
              stockAfter,
              note: note
                ? `PO ${order.poNumber}: ${note}`
                : `Penerimaan PO ${order.poNumber}`,
              tenantId: session.user.tenantId!,
              productId: poItem.productId,
              outletId: order.outletId,
            },
          });

          // BUG 4: update Product.buyPrice only for non-variant products
          if (ri.buyPrice !== undefined && ri.buyPrice !== poItem.buyPrice) {
            await tx.product.update({
              where: { id: poItem.productId },
              data: { buyPrice: effectiveBuyPrice },
            });
          }
        }
      }

      // 5. Hitung status PO baru
      // Re-fetch items setelah update
      const updatedItems = await tx.purchaseOrderItem.findMany({
        where: { purchaseOrderId: id },
        select: { quantity: true, quantityReceived: true, buyPrice: true },
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

      // BUG 15: recalculate totalCost from updated items
      const newTotalCost = updatedItems.reduce(
        (sum, item) => sum + item.quantity * item.buyPrice,
        0
      );

      const updatedOrder = await tx.purchaseOrder.update({
        where: { id },
        data: {
          status: newStatus,
          totalCost: newTotalCost,
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
