import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { generateSKUPrefix, formatSKUNumber } from "@/lib/utils";
import { parseBody, createProductSchema } from "@/lib/schemas";
import { logAudit } from "@/lib/audit";

/**
 * Generate SKU otomatis berdasarkan nama produk dan urutan per prefix.
 * Contoh: "Kopi Hitam" → KOP-0001, KOP-0002, dst
 * Memastikan unik per tenant.
 *
 * Menggunakan satu query findMany untuk menghindari N+1.
 */
async function generateUniqueSKU(
  productName: string,
  tenantId: string
): Promise<string> {
  const prefix = generateSKUPrefix(productName);

  // Ambil semua SKU dengan prefix ini sekaligus (1 query, bukan loop 100 query)
  const existingProducts = await prisma.product.findMany({
    where: {
      tenantId,
      sku: { startsWith: `${prefix}-` },
    },
    select: { sku: true },
    orderBy: { sku: "desc" },
  });

  // Kumpulkan semua nomor yang sudah terpakai
  const usedNumbers = new Set<number>();
  for (const p of existingProducts) {
    const match = p.sku?.match(/-(\d+)$/);
    if (match) usedNumbers.add(parseInt(match[1]));
  }

  // Cari nomor berikutnya yang belum terpakai
  let nextNumber = 1;
  while (usedNumbers.has(nextNumber)) {
    nextNumber++;
  }

  return `${prefix}-${formatSKUNumber(nextNumber)}`;
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const categoryId = searchParams.get("categoryId");
    const requestedOutletId = searchParams.get("outletId");
    const isActiveParam = searchParams.get("isActive");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    // Owner can inspect stock for a source outlet during stock transfer.
    const { getActiveOutletId } = await import("@/lib/active-outlet");
    let activeOutletId = await getActiveOutletId();
    if (requestedOutletId) {
      if (session.user.role !== "OWNER") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const requestedOutlet = await prisma.outlet.findFirst({
        where: {
          id: requestedOutletId,
          tenantId: session.user.tenantId,
          isActive: true,
        },
        select: { id: true },
      });
      if (!requestedOutlet) {
        return NextResponse.json({ error: "Cabang tidak valid." }, { status: 400 });
      }
      activeOutletId = requestedOutlet.id;
    }

    const where = {
      tenantId: session.user.tenantId,
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { sku: { contains: search, mode: "insensitive" as const } },
          { barcode: { contains: search } },
        ],
      }),
      ...(categoryId && { categoryId }),
      // BUG 17: support isActive filter — "true" → only active, "false" → only inactive
      ...(isActiveParam === "true" && { isActive: true }),
      ...(isActiveParam === "false" && { isActive: false }),
    };

    const [productsRaw, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: true,
          outletStocks: activeOutletId
            ? { where: { outletId: activeOutletId }, take: 1 }
            : false,
        },
        orderBy: { name: "asc" },
        skip,
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    // Transform: gunakan stock dari OutletStock kalau ada
    const products = productsRaw.map((p) => {
      const outletStock = p.outletStocks?.[0];
      return {
        ...p,
        stock: outletStock?.stock ?? p.stock,
        minStock: outletStock?.minStock ?? p.minStock,
        outletStocks: undefined,
      };
    });

    return NextResponse.json({ products, total, page, limit });
  } catch (error) {
    console.error("Get products error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user.tenantId || session.user.role === "KASIR") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const parsed = await parseBody(req, createProductSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }

    const {
      name, sku, barcode, description, imageUrl, buyPrice, sellPrice,
      stock, minStock, unit, categoryId, isActive, hasVariants,
    } = parsed.data;

    if (categoryId) {
      const category = await prisma.category.findFirst({
        where: { id: categoryId, tenantId: session.user.tenantId },
        select: { id: true },
      });
      if (!category) {
        return NextResponse.json({ error: "Kategori tidak valid." }, { status: 400 });
      }
    }

    // Cek limit produk berdasarkan plan
    const tenant = await prisma.tenant.findUnique({
      where: { id: session.user.tenantId },
      select: { maxProducts: true, plan: true },
    });

    if (tenant && tenant.plan === "FREE") {
      const productCount = await prisma.product.count({
        where: { tenantId: session.user.tenantId },
      });
      if (productCount >= tenant.maxProducts) {
        return NextResponse.json(
          { error: `Batas produk paket FREE (${tenant.maxProducts} produk) telah tercapai. Upgrade ke Pro untuk produk unlimited.` },
          { status: 403 }
        );
      }
    }

    // Handle SKU: auto-generate jika kosong, validasi unik jika diisi manual
    let finalSku: string;
    const trimmedSku = sku?.trim();

    if (trimmedSku) {
      // Owner input manual — cek unik per tenant
      const existing = await prisma.product.findFirst({
        where: { tenantId: session.user.tenantId, sku: trimmedSku },
        select: { id: true },
      });
      if (existing) {
        return NextResponse.json(
          { error: `SKU "${trimmedSku}" sudah dipakai produk lain.` },
          { status: 409 }
        );
      }
      finalSku = trimmedSku;
    } else {
      // Auto-generate berdasarkan nama produk
      finalSku = await generateUniqueSKU(name, session.user.tenantId);
    }

    const product = await prisma.$transaction(async (tx) => {
      const newProduct = await tx.product.create({
        data: {
          name,
          sku: finalSku,
          barcode: barcode || null,
          description: description || null,
          imageUrl: imageUrl || null,
          buyPrice: buyPrice || 0,
          sellPrice,
          stock: stock || 0,
          minStock: minStock || 5,
          unit: unit || "pcs",
          isActive: isActive !== false,
          hasVariants: hasVariants ?? false,
          tenantId: session.user.tenantId!,
          categoryId: categoryId || null,
        },
        include: { category: true },
      });

      // Buat OutletStock untuk semua outlet milik tenant ini
      // Stok awal hanya masuk ke outlet utama, outlet lain mulai dari 0
      const outlets = await tx.outlet.findMany({
        where: { tenantId: session.user.tenantId!, isActive: true },
        select: { id: true, isMain: true },
      });

      for (const outlet of outlets) {
        const initialStock = outlet.isMain ? (stock || 0) : 0;
        await tx.outletStock.create({
          data: {
            outletId: outlet.id,
            productId: newProduct.id,
            tenantId: session.user.tenantId!,
            stock: initialStock,
            minStock: minStock || 5,
          },
        });

        // Catat mutasi awal di outlet utama
        if (outlet.isMain && initialStock > 0) {
          await tx.stockMutation.create({
            data: {
              type: "IN",
              quantity: initialStock,
              stockBefore: 0,
              stockAfter: initialStock,
              note: "Stok awal produk",
              tenantId: session.user.tenantId!,
              productId: newProduct.id,
              outletId: outlet.id,
            },
          });
        }
      }

      return { product: newProduct, outlets };
    });

    // Resolve outlet aktif untuk menampilkan stok yang benar
    const { getActiveOutletId } = await import("@/lib/active-outlet");
    const activeOutletId = await getActiveOutletId();
    let displayStock = product.product.stock;
    let displayMinStock = product.product.minStock;
    if (activeOutletId) {
      const outletStock = await prisma.outletStock.findUnique({
        where: {
          outletId_productId: { outletId: activeOutletId, productId: product.product.id },
        },
        select: { stock: true, minStock: true },
      });
      if (outletStock) {
        displayStock = outletStock.stock;
        displayMinStock = outletStock.minStock;
      }
    }

    logAudit({
      action: "CREATE",
      entity: "Product",
      entityId: product.product.id,
      entityName: product.product.name,
      userId: session.user.id,
      tenantId: session.user.tenantId!,
    });

    return NextResponse.json(
      {
        product: {
          ...product.product,
          stock: displayStock,
          minStock: displayMinStock,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create product error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
