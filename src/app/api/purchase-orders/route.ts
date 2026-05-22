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
  expectedDate: z.string().optional().nullable(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1, "ID produk tidak valid."),
        quantity: z.number().int().positive("Jumlah harus lebih dari 0."),
        buyPrice: z.number().nonnegative("Harga beli tidak boleh negatif."),
        note: z.string().max(200).optional().nullable(),
      })
    )
    .min(1, "Minimal 1 produk dalam PO."),
});

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
    const status = searchParams.get("status");
    const outletId = searchParams.get("outletId");
    const skip = (page - 1) * limit;

    const where = {
      tenantId: session.user.tenantId,
      ...(status && { status: status as "DRAFT" | "ORDERED" | "PARTIAL" | "RECEIVED" | "CANCELLED" }),
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

    const poNumber = generateInvoiceNumber("PO");
    const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
    const totalCost = items.reduce((sum, i) => sum + i.quantity * i.buyPrice, 0);

    const order = await prisma.purchaseOrder.create({
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
            };
          }),
        },
      },
      include: {
        outlet: { select: { name: true } },
        items: { include: { product: { select: { name: true, unit: true } } } },
      },
    });

    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    console.error("Create purchase order error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
