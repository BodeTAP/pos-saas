import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getActiveOutletId } from "@/lib/active-outlet";
import { parseBody } from "@/lib/schemas";
import { z } from "zod";

// Schema untuk bulk adjustment
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

// Schema untuk single adjustment
const singleAdjustmentSchema = z.object({
  productId: z.string().cuid("ID produk tidak valid."),
  outletId: z.string().cuid("ID cabang tidak valid."),
  type: z.enum(["IN", "OUT", "ADJUSTMENT"], {
    errorMap: () => ({ message: "Tipe mutasi tidak valid." }),
  }),
  quantity: z.number().int().positive("Jumlah harus lebih dari 0."),
  note: z.string().max(200).optional(),
});

/**
 * GET /api/stock-mutations
 * Riwayat mutasi stok dengan filter
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user.tenantId || session.user.role !== "OWNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "30") || 30));
    const outletId = searchParams.get("outletId");
    const productId = searchParams.get("productId");
    const skip = (page - 1) * limit;

    // Validasi type — hanya nilai yang dikenal
    const VALID_TYPES = ["IN", "OUT", "ADJUSTMENT", "SALE", "RETURN", "PURCHASE"] as const;
    type MutationType = typeof VALID_TYPES[number];
    const typeParam = searchParams.get("type");
    const type = typeParam && VALID_TYPES.includes(typeParam as MutationType)
      ? (typeParam as MutationType)
      : null;

    // Validasi tanggal — cegah crash dari string tidak valid
    const dateFromParam = searchParams.get("dateFrom");
    const dateToParam = searchParams.get("dateTo");
    const dateFrom = dateFromParam && !isNaN(Date.parse(dateFromParam))
      ? new Date(dateFromParam)
      : null;
    const dateTo = dateToParam && !isNaN(Date.parse(dateToParam))
      ? new Date(new Date(dateToParam).setHours(23, 59, 59, 999))
      : null;

    const where = {
      tenantId: session.user.tenantId,
      ...(outletId && { outletId }),
      ...(productId && { productId }),
      ...(type && { type }),
      ...((dateFrom || dateTo) && {
        createdAt: {
          ...(dateFrom && { gte: dateFrom }),
          ...(dateTo && { lte: dateTo }),
        },
      }),
    };

    const [mutations, total] = await Promise.all([
      prisma.stockMutation.findMany({
        where,
        include: {
          product: { select: { name: true, sku: true, unit: true } },
          outlet: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.stockMutation.count({ where }),
    ]);

    return NextResponse.json({ mutations, total, page, limit });
  } catch (error) {
    console.error("Get stock mutations error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/**
 * POST /api/stock-mutations
 * Single stock adjustment (IN/OUT/ADJUSTMENT)
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user.tenantId || session.user.role !== "OWNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const parsed = await parseBody(req, singleAdjustmentSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }

    const { productId, outletId, type, quantity, note } = parsed.data;

    // Validasi outlet milik tenant
    const outlet = await prisma.outlet.findFirst({
      where: { id: outletId, tenantId: session.user.tenantId, isActive: true },
      select: { id: true },
    });
    if (!outlet) {
      return NextResponse.json({ error: "Cabang tidak valid." }, { status: 400 });
    }

    // Validasi produk milik tenant
    const product = await prisma.product.findFirst({
      where: { id: productId, tenantId: session.user.tenantId, isActive: true },
      select: { id: true, name: true },
    });
    if (!product) {
      return NextResponse.json({ error: "Produk tidak valid." }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const outletStock = await tx.outletStock.findUnique({
        where: { outletId_productId: { outletId, productId } },
        select: { stock: true },
      });

      const currentStock = outletStock?.stock ?? 0;
      let newStock: number;
      let mutationQty: number;

      if (type === "IN") {
        newStock = currentStock + quantity;
        mutationQty = quantity;
      } else if (type === "OUT") {
        if (currentStock < quantity) {
          throw new Error(`Stok ${product.name} tidak cukup. Stok saat ini: ${currentStock}.`);
        }
        newStock = currentStock - quantity;
        mutationQty = -quantity;
      } else {
        // ADJUSTMENT — set ke nilai baru
        newStock = quantity;
        mutationQty = quantity - currentStock;
      }

      // Update OutletStock
      await tx.outletStock.upsert({
        where: { outletId_productId: { outletId, productId } },
        update: { stock: newStock },
        create: {
          outletId,
          productId,
          tenantId: session.user.tenantId!,
          stock: newStock,
          minStock: 5,
        },
      });

      // Catat mutasi
      const mutation = await tx.stockMutation.create({
        data: {
          type,
          quantity: mutationQty,
          stockBefore: currentStock,
          stockAfter: newStock,
          note: note || null,
          tenantId: session.user.tenantId!,
          productId,
          outletId,
        },
      });

      return { mutation, newStock };
    });

    return NextResponse.json({ success: true, ...result }, { status: 201 });
  } catch (error) {
    console.error("Stock adjustment error:", error);
    const message = error instanceof Error ? error.message : "Gagal menyesuaikan stok.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
