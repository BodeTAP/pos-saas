import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getActiveOutletId } from "@/lib/active-outlet";

/**
 * GET /api/tables/[id]/order/items
 * Ambil semua order items dari order aktif di meja ini.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const outletId = await getActiveOutletId();
    const order = await prisma.tableOrder.findFirst({
      where: {
        tableId: id,
        tenantId: session.user.tenantId,
        closedAt: null,
        ...(outletId ? { table: { outletId } } : {}),
      },
      include: {
        items: {
          include: { modifiers: true },
          orderBy: { sentAt: "asc" },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ items: [] });
    }

    return NextResponse.json({ orderId: order.id, items: order.items });
  } catch (error) {
    console.error("Get order items error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/**
 * POST /api/tables/[id]/order/items
 * Kirim item pesanan ke dapur (tambah ke TableOrder aktif).
 *
 * Server-side validation:
 * - Outlet aktif (cegah cross-outlet)
 * - Produk milik tenant + isActive
 * - Variant SKU milik produk + isActive
 * - Modifier validation (required/min/max) per produk
 * - Server compute unitPrice dari DB (cegah harga manipulasi)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const outletId = await getActiveOutletId();
    if (!outletId) {
      return NextResponse.json({ error: "Cabang aktif tidak ditemukan." }, { status: 400 });
    }

    // Cari order aktif di meja ini (filter outlet juga)
    const order = await prisma.tableOrder.findFirst({
      where: {
        tableId: id,
        tenantId: session.user.tenantId,
        closedAt: null,
        table: { outletId },
      },
      select: { id: true, transactionId: true },
    });

    if (!order) {
      return NextResponse.json(
        { error: "Tidak ada order aktif di meja ini. Buka order terlebih dahulu." },
        { status: 404 }
      );
    }

    // Reject jika order sudah dibayar (PAY_FIRST flow)
    if (order.transactionId) {
      return NextResponse.json(
        { error: "Order sudah dibayar. Tidak bisa tambah item lagi." },
        { status: 409 }
      );
    }

    const body = await req.json() as {
      items: Array<{
        productId: string;
        productName?: string;
        productSku?: string | null;
        variantSkuId?: string | null;
        variantLabel?: string | null;
        quantity: number;
        unitPrice?: number; // diabaikan — server compute dari DB
        note?: string | null;
        modifiers?: Array<{
          groupId?: string;
          groupName: string;
          optionId?: string;
          optionName: string;
          extraPrice?: number;
        }>;
      }>;
    };

    if (!body.items || body.items.length === 0) {
      return NextResponse.json({ error: "Tidak ada item untuk dikirim." }, { status: 400 });
    }

    // Validasi produk milik tenant + ambil harga dari DB
    const productIds = [...new Set(body.items.map((i) => i.productId))];
    const ownedProducts = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        tenantId: session.user.tenantId,
        isActive: true,
      },
      include: {
        modifierGroups: {
          include: {
            group: {
              include: { options: true },
            },
          },
        },
      },
    });
    if (ownedProducts.length !== productIds.length) {
      return NextResponse.json({ error: "Satu atau lebih produk tidak valid." }, { status: 400 });
    }
    const productsById = new Map(ownedProducts.map((p) => [p.id, p]));

    // Validasi variant SKU
    const variantSkuIds = body.items.map((i) => i.variantSkuId).filter(Boolean) as string[];
    const variantSkusById = new Map<
      string,
      { id: string; price: number; sku: string | null; productId: string }
    >();
    if (variantSkuIds.length > 0) {
      const skus = await prisma.productVariantSKU.findMany({
        where: {
          id: { in: variantSkuIds },
          productId: { in: productIds },
          isActive: true,
        },
        select: { id: true, price: true, sku: true, productId: true },
      });
      if (skus.length !== variantSkuIds.length) {
        return NextResponse.json({ error: "Satu atau lebih varian tidak valid." }, { status: 400 });
      }
      skus.forEach((s) => variantSkusById.set(s.id, s));
    }

    // Validate + compute setiap item
    type PreparedItem = {
      productId: string;
      productName: string;
      productSku: string | null;
      variantSkuId: string | null;
      variantLabel: string | null;
      quantity: number;
      unitPrice: number;
      note: string | null;
      modifiers: Array<{ groupName: string; optionName: string; extraPrice: number }>;
    };
    const prepared: PreparedItem[] = [];

    for (const item of body.items) {
      if (item.quantity < 1 || !Number.isInteger(item.quantity)) {
        return NextResponse.json(
          { error: "Kuantitas item tidak valid." },
          { status: 400 }
        );
      }

      const product = productsById.get(item.productId)!;
      const variantSku = item.variantSkuId ? variantSkusById.get(item.variantSkuId) : null;
      const basePrice = variantSku ? variantSku.price : product.sellPrice;

      // Validasi modifier sesuai aturan ModifierGroup produk
      const productGroups = product.modifierGroups.map((pg) => pg.group);
      const submittedModifiers = item.modifiers ?? [];

      // Group submitted modifiers by groupName (server source-of-truth)
      const submittedByGroup = new Map<string, typeof submittedModifiers>();
      for (const mod of submittedModifiers) {
        const list = submittedByGroup.get(mod.groupName) ?? [];
        list.push(mod);
        submittedByGroup.set(mod.groupName, list);
      }

      // Validasi setiap group milik produk
      for (const group of productGroups) {
        const submitted = submittedByGroup.get(group.name) ?? [];
        const count = submitted.length;

        if (group.required) {
          const minRequired = Math.max(1, group.minSelect);
          if (count < minRequired) {
            return NextResponse.json(
              {
                error: `Modifier "${group.name}" wajib dipilih minimal ${minRequired} untuk ${product.name}.`,
              },
              { status: 400 }
            );
          }
        } else {
          if (count > 0 && count < group.minSelect) {
            return NextResponse.json(
              { error: `Modifier "${group.name}" minimal ${group.minSelect} pilihan.` },
              { status: 400 }
            );
          }
        }
        if (count > group.maxSelect) {
          return NextResponse.json(
            { error: `Modifier "${group.name}" maksimal ${group.maxSelect} pilihan.` },
            { status: 400 }
          );
        }

        // Validate option name match (cegah injection nama random)
        const validOptions = new Set(group.options.map((o) => o.name));
        for (const sub of submitted) {
          if (!validOptions.has(sub.optionName)) {
            return NextResponse.json(
              { error: `Opsi "${sub.optionName}" tidak valid untuk grup "${group.name}".` },
              { status: 400 }
            );
          }
        }
      }

      // Reject submitted modifiers yang group-nya tidak terkait produk
      const validGroupNames = new Set(productGroups.map((g) => g.name));
      for (const mod of submittedModifiers) {
        if (!validGroupNames.has(mod.groupName)) {
          return NextResponse.json(
            { error: `Modifier "${mod.groupName}" tidak terkait produk ${product.name}.` },
            { status: 400 }
          );
        }
      }

      // Compute extraPrice dari DB (cegah manipulation)
      const computedModifiers: Array<{ groupName: string; optionName: string; extraPrice: number }> = [];
      for (const mod of submittedModifiers) {
        const group = productGroups.find((g) => g.name === mod.groupName)!;
        const option = group.options.find((o) => o.name === mod.optionName)!;
        computedModifiers.push({
          groupName: group.name,
          optionName: option.name,
          extraPrice: option.extraPrice,
        });
      }

      const modifierExtra = computedModifiers.reduce((s, m) => s + m.extraPrice, 0);
      const unitPrice = basePrice + modifierExtra;

      prepared.push({
        productId: product.id,
        productName: product.name,
        productSku: variantSku?.sku ?? product.sku,
        variantSkuId: item.variantSkuId ?? null,
        variantLabel: item.variantLabel ?? null,
        quantity: item.quantity,
        unitPrice,
        note: item.note ? item.note.slice(0, 200) : null,
        modifiers: computedModifiers,
      });
    }

    // Buat semua order items sekaligus
    const createdItems = await prisma.$transaction(
      prepared.map((item) =>
        prisma.orderItem.create({
          data: {
            tableOrderId: order.id,
            tenantId: session.user.tenantId!,
            productId: item.productId,
            productName: item.productName,
            productSku: item.productSku,
            variantSkuId: item.variantSkuId,
            variantLabel: item.variantLabel,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            note: item.note,
            status: "PENDING",
            modifiers:
              item.modifiers.length > 0
                ? {
                    create: item.modifiers.map((m) => ({
                      modifierGroupName: m.groupName,
                      modifierOptionName: m.optionName,
                      extraPrice: m.extraPrice,
                    })),
                  }
                : undefined,
          },
          include: { modifiers: true },
        })
      )
    );

    return NextResponse.json({ items: createdItems }, { status: 201 });
  } catch (error) {
    console.error("Send to kitchen error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
