import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * GET /api/inventory/low-stock
 * Daftar lengkap produk dengan stok di bawah minStock per outlet
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user.tenantId || session.user.role !== "OWNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const outletId = searchParams.get("outletId");

    const where = {
      tenantId: session.user.tenantId,
      product: { isActive: true },
      ...(outletId && { outletId }),
    };

    // Ambil semua OutletStock, filter yang stock <= minStock
    const allStocks = await prisma.outletStock.findMany({
      where,
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
        outlet: { select: { id: true, name: true } },
      },
      orderBy: { stock: "asc" },
    });

    const lowStock = allStocks.filter((s) => s.stock <= s.minStock);
    const outOfStock = lowStock.filter((s) => s.stock === 0);
    const critical = lowStock.filter((s) => s.stock > 0 && s.stock <= s.minStock);

    const items = lowStock.map((s) => ({
      productId: s.productId,
      productName: s.product.name,
      productSku: s.product.sku,
      productUnit: s.product.unit,
      categoryName: s.product.category?.name ?? null,
      outletId: s.outletId,
      outletName: s.outlet.name,
      stock: s.stock,
      minStock: s.minStock,
      status: s.stock === 0 ? "OUT_OF_STOCK" : "LOW_STOCK",
    }));

    return NextResponse.json({
      items,
      summary: {
        total: lowStock.length,
        outOfStock: outOfStock.length,
        critical: critical.length,
      },
    });
  } catch (error) {
    console.error("Low stock error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
