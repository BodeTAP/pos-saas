import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getActiveOutletId } from "@/lib/active-outlet";

/**
 * GET /api/offline/sync-data
 * Kirim semua data yang dibutuhkan untuk mode offline dalam 1 request.
 * Dipanggil saat app online, di-cache oleh service worker (StaleWhileRevalidate, 24 jam).
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const outletId = await getActiveOutletId();
    if (!outletId) {
      return NextResponse.json({ error: "Cabang aktif tidak ditemukan." }, { status: 400 });
    }

    // Ambil semua data sekaligus — 1 round trip
    const [productsRaw, categories, tenant, outlet] = await Promise.all([
      prisma.product.findMany({
        where: { tenantId: session.user.tenantId, isActive: true },
        include: {
          category: { select: { name: true } },
          outletStocks: { where: { outletId }, take: 1 },
          variantTypes: {
            include: {
              options: { orderBy: { createdAt: "asc" } },
            },
            orderBy: { position: "asc" },
          },
          variantSKUs: {
            where: { isActive: true },
            include: {
              options: {
                include: { option: { include: { variantType: true } } },
              },
              outletStocks: { where: { outletId }, take: 1 },
            },
          },
        },
        orderBy: { name: "asc" },
      }),
      prisma.category.findMany({
        where: { tenantId: session.user.tenantId },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.tenant.findUnique({
        where: { id: session.user.tenantId },
        select: {
          taxRate: true,
          currency: true,
          name: true,
          address: true,
          phone: true,
          receiptWidth: true,
          receiptNote: true,
          receiptHeader: true,
          pointsPerAmount: true,
          pointValue: true,
          activePaymentMethods: true,
          invoicePrefix: true,
        },
      }),
      prisma.outlet.findUnique({
        where: { id: outletId },
        select: { id: true, name: true },
      }),
    ]);

    // Transform produk — sertakan stok dari outlet aktif + varian
    const products = productsRaw.map((p) => {
      const outletStock = p.outletStocks[0];

      // Transform variant SKUs
      const variantSKUs = p.variantSKUs.map((sku) => ({
        id: sku.id,
        sku: sku.sku,
        price: sku.price,
        buyPrice: sku.buyPrice,
        imageUrl: sku.imageUrl,
        isActive: sku.isActive,
        stock: sku.outletStocks[0]?.stock ?? 0,
        minStock: sku.outletStocks[0]?.minStock ?? 5,
        label: sku.options
          .sort((a, b) => a.option.variantType.position - b.option.variantType.position)
          .map((o) => o.option.name)
          .join(" / "),
        optionIds: sku.options.map((o) => o.optionId),
      }));

      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        barcode: p.barcode,
        sellPrice: p.sellPrice,
        stock: outletStock?.stock ?? 0,
        minStock: outletStock?.minStock ?? p.minStock,
        unit: p.unit,
        imageUrl: p.imageUrl,
        isActive: p.isActive,
        categoryId: p.categoryId,
        categoryName: p.category?.name ?? null,
        hasVariants: p.hasVariants,
        variantTypes: p.variantTypes.map((vt) => ({
          id: vt.id,
          name: vt.name,
          position: vt.position,
          options: vt.options.map((opt) => ({ id: opt.id, name: opt.name })),
        })),
        variantSKUs,
      };
    });

    const config = tenant
      ? {
          taxRate: tenant.taxRate,
          currency: tenant.currency,
          name: tenant.name,
          address: tenant.address,
          phone: tenant.phone,
          receiptWidth: tenant.receiptWidth,
          receiptNote: tenant.receiptNote,
          receiptHeader: tenant.receiptHeader,
          pointsPerAmount: tenant.pointsPerAmount,
          pointValue: tenant.pointValue,
          activePaymentMethods: tenant.activePaymentMethods,
          invoicePrefix: tenant.invoicePrefix,
          outletId,
          outletName: outlet?.name ?? "Cabang",
          cashierId: session.user.id,
          cashierName: session.user.name ?? "Kasir",
        }
      : null;

    const response = NextResponse.json({
      products,
      categories,
      config,
      syncedAt: new Date().toISOString(),
    });

    // Cache header — service worker akan cache response ini
    response.headers.set(
      "Cache-Control",
      "public, max-age=0, stale-while-revalidate=86400"
    );

    return response;
  } catch (error) {
    console.error("Offline sync-data error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
