import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { parseBody } from "@/lib/schemas";
import { z } from "zod";

const stockOpnameSchema = z.object({
  outletId: z.string().cuid("ID cabang tidak valid."),
  items: z
    .array(
      z.object({
        productId: z.string().cuid("ID produk tidak valid."),
        physicalStock: z.number().int().nonnegative("Stok fisik tidak boleh negatif."),
        note: z.string().max(200).optional(),
      })
    )
    .min(1, "Minimal 1 produk harus diinput."),
  note: z.string().max(300).optional(),
});

/**
 * GET /api/stock-opname
 * Ambil data produk + stok sistem untuk form opname
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user.tenantId || session.user.role !== "OWNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const outletId = searchParams.get("outletId");

    if (!outletId) {
      return NextResponse.json({ error: "outletId wajib diisi." }, { status: 400 });
    }

    // Validasi outlet milik tenant
    const outlet = await prisma.outlet.findFirst({
      where: { id: outletId, tenantId: session.user.tenantId, isActive: true },
      select: { id: true, name: true },
    });
    if (!outlet) {
      return NextResponse.json({ error: "Cabang tidak valid." }, { status: 400 });
    }

    // Ambil semua produk aktif + stok di outlet ini
    const outletStocks = await prisma.outletStock.findMany({
      where: {
        outletId,
        tenantId: session.user.tenantId,
        product: { isActive: true },
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            unit: true,
            category: { select: { name: true } },
          },
        },
      },
      orderBy: { product: { name: "asc" } },
    });

    const items = outletStocks.map((os) => ({
      productId: os.productId,
      productName: os.product.name,
      productSku: os.product.sku,
      productUnit: os.product.unit,
      categoryName: os.product.category?.name ?? null,
      systemStock: os.stock,
      minStock: os.minStock,
    }));

    return NextResponse.json({ outlet, items });
  } catch (error) {
    console.error("Get stock opname error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/**
 * POST /api/stock-opname
 * Submit hasil stock opname — update stok sesuai hitungan fisik
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user.tenantId || session.user.role !== "OWNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const parsed = await parseBody(req, stockOpnameSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }

    const { outletId, items, note } = parsed.data;

    // Validasi outlet milik tenant
    const outlet = await prisma.outlet.findFirst({
      where: { id: outletId, tenantId: session.user.tenantId, isActive: true },
      select: { id: true, name: true },
    });
    if (!outlet) {
      return NextResponse.json({ error: "Cabang tidak valid." }, { status: 400 });
    }

    // Validasi semua produk milik tenant
    const productIds = items.map((i) => i.productId);
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

    // Ambil stok sistem saat ini
    const existingStocks = await prisma.outletStock.findMany({
      where: { outletId, productId: { in: productIds } },
      select: { productId: true, stock: true },
    });
    const stockMap = new Map(existingStocks.map((s) => [s.productId, s.stock]));
    const productMap = new Map(products.map((p) => [p.id, p]));

    const opnameNote = note || "Stock opname";

    const results = await prisma.$transaction(async (tx) => {
      const mutations = [];
      let totalVariance = 0;

      for (const item of items) {
        const systemStock = stockMap.get(item.productId) ?? 0;
        const physicalStock = item.physicalStock;
        const variance = physicalStock - systemStock;

        // Update OutletStock ke stok fisik
        await tx.outletStock.upsert({
          where: { outletId_productId: { outletId, productId: item.productId } },
          update: { stock: physicalStock },
          create: {
            outletId,
            productId: item.productId,
            tenantId: session.user.tenantId!,
            stock: physicalStock,
            minStock: 5,
          },
        });

        // Catat mutasi ADJUSTMENT
        const mutation = await tx.stockMutation.create({
          data: {
            type: "ADJUSTMENT",
            quantity: variance,
            stockBefore: systemStock,
            stockAfter: physicalStock,
            note: item.note
              ? `${opnameNote} — ${item.note}`
              : opnameNote,
            tenantId: session.user.tenantId!,
            productId: item.productId,
            outletId,
          },
        });

        totalVariance += Math.abs(variance);
        mutations.push({
          productId: item.productId,
          productName: productMap.get(item.productId)?.name,
          systemStock,
          physicalStock,
          variance,
          mutationId: mutation.id,
        });
      }

      return { mutations, totalVariance };
    });

    return NextResponse.json(
      {
        success: true,
        processed: results.mutations.length,
        totalVariance: results.totalVariance,
        results: results.mutations,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Stock opname error:", error);
    return NextResponse.json({ error: "Gagal memproses stock opname." }, { status: 500 });
  }
}
