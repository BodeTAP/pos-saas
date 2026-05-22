import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { parseBody } from "@/lib/schemas";
import { z } from "zod";

const bulkAdjustmentSchema = z.object({
  outletId: z.string().cuid("ID cabang tidak valid."),
  adjustments: z
    .array(
      z.object({
        productId: z.string().cuid("ID produk tidak valid."),
        newStock: z.number().int().nonnegative("Stok tidak boleh negatif."),
        note: z.string().max(200).optional(),
      })
    )
    .min(1, "Minimal 1 produk harus disesuaikan."),
  globalNote: z.string().max(200).optional(),
});

/**
 * POST /api/stock-mutations/bulk
 * Bulk stock adjustment — update stok banyak produk sekaligus
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user.tenantId || session.user.role !== "OWNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const parsed = await parseBody(req, bulkAdjustmentSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }

    const { outletId, adjustments, globalNote } = parsed.data;

    // Validasi outlet milik tenant
    const outlet = await prisma.outlet.findFirst({
      where: { id: outletId, tenantId: session.user.tenantId, isActive: true },
      select: { id: true, name: true },
    });
    if (!outlet) {
      return NextResponse.json({ error: "Cabang tidak valid." }, { status: 400 });
    }

    // Validasi semua produk milik tenant
    const productIds = adjustments.map((a) => a.productId);
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        tenantId: session.user.tenantId,
        isActive: true,
      },
      select: { id: true, name: true },
    });

    if (products.length !== productIds.length) {
      return NextResponse.json(
        { error: "Satu atau lebih produk tidak valid." },
        { status: 400 }
      );
    }

    const productMap = new Map(products.map((p) => [p.id, p]));

    // Ambil semua OutletStock sekaligus
    const existingStocks = await prisma.outletStock.findMany({
      where: {
        outletId,
        productId: { in: productIds },
      },
      select: { productId: true, stock: true },
    });
    const stockMap = new Map(existingStocks.map((s) => [s.productId, s.stock]));

    const results = await prisma.$transaction(async (tx) => {
      const mutations = [];

      for (const adj of adjustments) {
        const currentStock = stockMap.get(adj.productId) ?? 0;
        const newStock = adj.newStock;

        if (currentStock === newStock) continue; // Tidak ada perubahan, skip

        // Update OutletStock
        await tx.outletStock.upsert({
          where: { outletId_productId: { outletId, productId: adj.productId } },
          update: { stock: newStock },
          create: {
            outletId,
            productId: adj.productId,
            tenantId: session.user.tenantId!,
            stock: newStock,
            minStock: 5,
          },
        });

        // Catat mutasi
        const mutation = await tx.stockMutation.create({
          data: {
            type: "ADJUSTMENT",
            quantity: newStock - currentStock,
            stockBefore: currentStock,
            stockAfter: newStock,
            note: adj.note || globalNote || "Penyesuaian stok massal",
            tenantId: session.user.tenantId!,
            productId: adj.productId,
            outletId,
          },
        });

        mutations.push({
          productId: adj.productId,
          productName: productMap.get(adj.productId)?.name,
          stockBefore: currentStock,
          stockAfter: newStock,
          mutationId: mutation.id,
        });
      }

      return mutations;
    });

    return NextResponse.json(
      {
        success: true,
        adjusted: results.length,
        skipped: adjustments.length - results.length,
        results,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Bulk adjustment error:", error);
    return NextResponse.json({ error: "Gagal memproses penyesuaian stok massal." }, { status: 500 });
  }
}
