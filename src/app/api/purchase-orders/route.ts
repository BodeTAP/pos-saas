import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { parseBody } from "@/lib/schemas";
import { z } from "zod";
import { generateInvoiceNumber } from "@/lib/utils";

const createPOSchema = z.object({
  outletId: z.string().min(1, "ID cabang tidak valid."),
  supplierName: z.string().max(100).optional().nullable(),
  supplierPhone: z.string().max(20).optional().nullable(),
  note: z.string().max(500).optional().nullable(),
  // BUG 14: validate expectedDate is a real date string
  expectedDate: z
    .string()
    .optional()
    .nullable()
    .refine((v) => !v || !isNaN(Date.parse(v)), "Format tanggal tidak valid."),
  items: z
    .array(
      z.object({
        productId: z.string().min(1, "ID produk tidak valid."),
        quantity: z.number().int().positive("Jumlah harus lebih dari 0."),
        buyPrice: z.number().nonnegative("Harga beli tidak boleh negatif."),
        note: z.string().max(200).optional().nullable(),
        // BUG 3: optional variantSkuId per item
        variantSkuId: z.string().optional().nullable(),
      })
    )
    .min(1, "Minimal 1 produk dalam PO."),
});

// BUG 22: valid status values for filter
const VALID_STATUSES = ["DRAFT", "ORDERED", "PARTIAL", "RECEIVED", "CANCELLED"] as const;
type POStatus = (typeof VALID_STATUSES)[number];

/**
 * GET /api/purchase-orders
 * Daftar semua PO dengan filter status
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user.tenantId || session.user.role !== "OWNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const statusParam = searchParams.get("status");
    const outletId = searchParams.get("outletId");
    const skip = (page - 1) * limit;

    // BUG 22: validate status against known values to prevent injection
    const safeStatus =
      statusParam && VALID_STATUSES.includes(statusParam as POStatus)
        ? (statusParam as POStatus)
        : null;

    // BUG 21: outletId is safe because tenantId is always in the where clause,
    // preventing cross-tenant leakage even if an arbitrary outletId is supplied.
    const where = {
      tenantId: session.user.tenantId,
      ...(safeStatus && { status: safeStatus }),
      ...(outletId && { outletId }),
    };

    const [orders, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        include: {
          outlet: { select: { name: true } },
          items: {
            include: { product: { select: { name: true, unit: true } } },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.purchaseOrder.count({ where }),
    ]);

    return NextResponse.json({ orders, total, page, limit });
  } catch (error) {
    console.error("Get purchase orders error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/**
 * POST /api/purchase-orders
 * Buat PO baru (status DRAFT)
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user.tenantId || session.user.role !== "OWNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const parsed = await parseBody(req, createPOSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }

    const { outletId, supplierName, supplierPhone, note, expectedDate, items } = parsed.data;

    // Validasi outlet milik tenant
    const outlet = await prisma.outlet.findFirst({
      where: { id: outletId, tenantId: session.user.tenantId, isActive: true },
      select: { id: true },
    });
    if (!outlet) {
      return NextResponse.json({ error: "Cabang tidak valid." }, { status: 400 });
    }

    // Validasi semua produk milik tenant
    const productIds = [...new Set(items.map((i) => i.productId))];
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, tenantId: session.user.tenantId, isActive: true },
      select: { id: true, name: true, sku: true, buyPrice: true },
    });
    if (products.length !== productIds.length) {
      return NextResponse.json({ error: "Satu atau lebih produk tidak valid." }, { status: 400 });
    }
    const productMap = new Map(products.map((p) => [p.id, p]));

    // BUG 3: validate variantSkuIds if provided
    const variantSkuIds = items
      .map((i) => i.variantSkuId)
      .filter((id): id is string => !!id);
    if (variantSkuIds.length > 0) {
      const variantSkus = await prisma.productVariantSKU.findMany({
        where: { id: { in: variantSkuIds } },
        select: { id: true, sku: true },
      });
      const variantSkuMap = new Map(variantSkus.map((v) => [v.id, v]));
      for (const item of items) {
        if (item.variantSkuId && !variantSkuMap.has(item.variantSkuId)) {
          return NextResponse.json(
            { error: `Varian SKU ${item.variantSkuId} tidak valid.` },
            { status: 400 }
          );
        }
      }
    }

    const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
    const totalCost = items.reduce((sum, i) => sum + i.quantity * i.buyPrice, 0);

    // BUG 1: retry loop (max 3 attempts) to handle poNumber unique constraint violations
    let order = null;
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const poNumber = generateInvoiceNumber("PO");
      try {
        order = await prisma.purchaseOrder.create({
          data: {
            poNumber,
            status: "DRAFT",
            supplierName: supplierName || null,
            supplierPhone: supplierPhone || null,
            note: note || null,
            expectedDate: expectedDate ? new Date(expectedDate) : null,
            totalItems,
            totalCost,
            tenantId: session.user.tenantId,
            outletId,
            items: {
              create: items.map((item) => {
                const product = productMap.get(item.productId)!;
                return {
                  productId: item.productId,
                  productName: product.name,
                  productSku: product.sku || null,
                  quantity: item.quantity,
                  quantityReceived: 0,
                  buyPrice: item.buyPrice,
                  note: item.note || null,
                  // BUG 3: store variantSkuId if provided
                  variantSkuId: item.variantSkuId || null,
                };
              }),
            },
          },
          include: {
            outlet: { select: { name: true } },
            items: { include: { product: { select: { name: true, unit: true } } } },
          },
        });
        break; // success — exit retry loop
      } catch (err: unknown) {
        // Check for unique constraint violation on poNumber (Prisma error code P2002)
        if (
          err &&
          typeof err === "object" &&
          "code" in err &&
          (err as { code: string }).code === "P2002"
        ) {
          lastError = err;
          continue; // retry with a new poNumber
        }
        throw err; // re-throw non-collision errors immediately
      }
    }

    if (!order) {
      console.error("PO number collision after 3 attempts:", lastError);
      return NextResponse.json(
        { error: "Gagal membuat nomor PO unik. Coba lagi." },
        { status: 500 }
      );
    }

    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    console.error("Create purchase order error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
