import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { parseBody } from "@/lib/schemas";

// ─────────────────────────────────────────────
// SCHEMA VALIDASI
// ─────────────────────────────────────────────

const variantOptionSchema = z.object({
  name: z.string().min(1, "Nama opsi wajib diisi.").max(50),
});

const variantTypeSchema = z.object({
  id: z.string().cuid().optional(), // ada = update, tidak ada = create
  name: z.string().min(1, "Nama tipe varian wajib diisi.").max(50),
  position: z.number().int().min(0).default(0),
  options: z.array(variantOptionSchema).min(1, "Minimal 1 opsi per tipe varian."),
});

const variantSKUSchema = z.object({
  id: z.string().cuid().optional(),
  // optionIds dikirim sebagai "typeIdx-optionIdx" (e.g. "0-0", "1-2") — bukan CUID
  optionIds: z.array(z.string().min(1)).min(1, "SKU harus punya minimal 1 opsi."),
  price: z.number().positive("Harga harus lebih dari 0."),
  buyPrice: z.number().nonnegative().default(0),
  sku: z.string().max(50).optional().nullable(),
  barcode: z.string().max(100).optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  stock: z.number().int().nonnegative().default(0),
  minStock: z.number().int().nonnegative().default(5),
  isActive: z.boolean().default(true),
});

const saveVariantsSchema = z.object({
  variantTypes: z.array(variantTypeSchema).min(1, "Minimal 1 tipe varian."),
  skus: z.array(variantSKUSchema).min(1, "Minimal 1 SKU varian."),
});

// ─────────────────────────────────────────────
// GET — ambil semua varian produk
// ─────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: productId } = await params;
    const session = await auth();
    if (!session?.user.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const product = await prisma.product.findFirst({
      where: { id: productId, tenantId: session.user.tenantId },
      select: { id: true, hasVariants: true },
    });
    if (!product) {
      return NextResponse.json({ error: "Produk tidak ditemukan." }, { status: 404 });
    }

    const { getActiveOutletId } = await import("@/lib/active-outlet");
    const outletId = await getActiveOutletId();

    const [variantTypes, skus] = await Promise.all([
      prisma.productVariantType.findMany({
        where: { productId },
        include: { options: { orderBy: { createdAt: "asc" } } },
        orderBy: { position: "asc" },
      }),
      prisma.productVariantSKU.findMany({
        where: { productId },
        include: {
          options: {
            include: { option: { include: { variantType: true } } },
          },
          outletStocks: outletId
            ? { where: { outletId }, take: 1 }
            : false,
        },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    // Transform SKUs untuk response
    const skusFormatted = skus.map((sku) => ({
      id: sku.id,
      sku: sku.sku,
      barcode: sku.barcode,
      imageUrl: sku.imageUrl,
      price: sku.price,
      buyPrice: sku.buyPrice,
      isActive: sku.isActive,
      stock: sku.outletStocks?.[0]?.stock ?? 0,
      minStock: sku.outletStocks?.[0]?.minStock ?? 5,
      optionIds: sku.options.map((o) => o.optionId),
      // Label untuk display: "S / Merah"
      label: sku.options
        .sort((a, b) => a.option.variantType.position - b.option.variantType.position)
        .map((o) => o.option.name)
        .join(" / "),
    }));

    return NextResponse.json({ variantTypes, skus: skusFormatted });
  } catch (error) {
    console.error("Get variants error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ─────────────────────────────────────────────
// POST — simpan/update semua varian sekaligus (replace strategy)
// ─────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: productId } = await params;
    const session = await auth();
    if (!session?.user.tenantId || session.user.role === "KASIR") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const product = await prisma.product.findFirst({
      where: { id: productId, tenantId: session.user.tenantId },
    });
    if (!product) {
      return NextResponse.json({ error: "Produk tidak ditemukan." }, { status: 404 });
    }

    const parsed = await parseBody(req, saveVariantsSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }

    const { variantTypes, skus } = parsed.data;

    // Ambil semua outlet tenant untuk buat OutletStockVariant
    const outlets = await prisma.outlet.findMany({
      where: { tenantId: session.user.tenantId, isActive: true },
      select: { id: true, isMain: true },
    });

    await prisma.$transaction(async (tx) => {
      // 1. Hapus semua varian lama (cascade akan hapus options, skus, stocks)
      await tx.productVariantType.deleteMany({ where: { productId } });

      // 2. Buat tipe varian baru
      const createdTypes: Array<{ id: string; options: Array<{ id: string; name: string }> }> = [];

      for (const vt of variantTypes) {
        const createdType = await tx.productVariantType.create({
          data: {
            name: vt.name,
            position: vt.position,
            productId,
            options: {
              create: vt.options.map((opt) => ({ name: opt.name })),
            },
          },
          include: { options: true },
        });
        createdTypes.push(createdType);
      }

      // Build map: "TypeName:OptionName" → optionId (untuk matching dari client)
      // Client kirim optionIds berdasarkan index, kita perlu map ke ID yang baru dibuat
      // Strategi: client kirim optionIds sebagai array index "typeIdx:optionIdx"
      // Tapi lebih aman: client kirim nama kombinasi, server resolve
      // Untuk simplicity: client kirim array of option names per type, server match by position

      // Flatten semua options dengan index
      const allOptions: Array<{ id: string; typeIdx: number; optionIdx: number }> = [];
      createdTypes.forEach((ct, typeIdx) => {
        ct.options.forEach((opt, optionIdx) => {
          allOptions.push({ id: opt.id, typeIdx, optionIdx });
        });
      });

      // 3. Buat SKU varian
      for (const skuData of skus) {
        // optionIds dari client adalah array index "typeIdx-optionIdx"
        // Format: ["0-0", "1-1"] = type 0 option 0, type 1 option 1
        const resolvedOptionIds = skuData.optionIds.map((indexStr) => {
          const [typeIdx, optionIdx] = indexStr.split("-").map(Number);
          const found = allOptions.find(
            (o) => o.typeIdx === typeIdx && o.optionIdx === optionIdx
          );
          return found?.id;
        }).filter(Boolean) as string[];

        if (resolvedOptionIds.length === 0) continue;

        const newSku = await tx.productVariantSKU.create({
          data: {
            sku: skuData.sku || null,
            barcode: skuData.barcode || null,
            imageUrl: skuData.imageUrl || null,
            price: skuData.price,
            buyPrice: skuData.buyPrice,
            isActive: skuData.isActive,
            productId,
            options: {
              create: resolvedOptionIds.map((optionId) => ({ optionId })),
            },
          },
        });

        // Buat OutletStockVariant untuk semua outlet
        for (const outlet of outlets) {
          const initialStock = outlet.isMain ? (skuData.stock || 0) : 0;
          await tx.outletStockVariant.create({
            data: {
              outletId: outlet.id,
              skuId: newSku.id,
              tenantId: session.user.tenantId!,
              stock: initialStock,
              minStock: skuData.minStock || 5,
            },
          });

          // Catat mutasi awal
          if (outlet.isMain && initialStock > 0) {
            await tx.stockMutationVariant.create({
              data: {
                type: "IN",
                quantity: initialStock,
                stockBefore: 0,
                stockAfter: initialStock,
                note: "Stok awal varian",
                tenantId: session.user.tenantId!,
                skuId: newSku.id,
                outletId: outlet.id,
              },
            });
          }
        }
      }

      // 4. Tandai produk sebagai hasVariants = true
      await tx.product.update({
        where: { id: productId },
        data: { hasVariants: true },
      });
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Save variants error:", error);
    return NextResponse.json({ error: "Gagal menyimpan varian." }, { status: 500 });
  }
}

// ─────────────────────────────────────────────
// DELETE — hapus semua varian, kembalikan ke produk biasa
// ─────────────────────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: productId } = await params;
    const session = await auth();
    if (!session?.user.tenantId || session.user.role === "KASIR") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const product = await prisma.product.findFirst({
      where: { id: productId, tenantId: session.user.tenantId },
    });
    if (!product) {
      return NextResponse.json({ error: "Produk tidak ditemukan." }, { status: 404 });
    }

    await prisma.$transaction([
      prisma.productVariantType.deleteMany({ where: { productId } }),
      prisma.product.update({
        where: { id: productId },
        data: { hasVariants: false },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete variants error:", error);
    return NextResponse.json({ error: "Gagal menghapus varian." }, { status: 500 });
  }
}
