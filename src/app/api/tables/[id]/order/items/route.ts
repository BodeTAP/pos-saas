import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

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

    const order = await prisma.tableOrder.findFirst({
      where: {
        tableId: id,
        tenantId: session.user.tenantId,
        closedAt: null,
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
 * Body: {
 *   items: Array<{
 *     productId: string;
 *     productName: string;
 *     productSku?: string | null;
 *     variantSkuId?: string | null;
 *     variantLabel?: string | null;
 *     quantity: number;
 *     unitPrice: number;
 *     note?: string | null;
 *     modifiers?: Array<{ groupName: string; optionName: string; extraPrice: number }>;
 *   }>
 * }
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

    // Cari order aktif di meja ini
    const order = await prisma.tableOrder.findFirst({
      where: {
        tableId: id,
        tenantId: session.user.tenantId,
        closedAt: null,
      },
      select: { id: true },
    });

    if (!order) {
      return NextResponse.json(
        { error: "Tidak ada order aktif di meja ini. Buka order terlebih dahulu." },
        { status: 404 }
      );
    }

    const body = await req.json() as {
      items: Array<{
        productId: string;
        productName: string;
        productSku?: string | null;
        variantSkuId?: string | null;
        variantLabel?: string | null;
        quantity: number;
        unitPrice: number;
        note?: string | null;
        modifiers?: Array<{ groupName: string; optionName: string; extraPrice: number }>;
      }>;
    };

    if (!body.items || body.items.length === 0) {
      return NextResponse.json({ error: "Tidak ada item untuk dikirim." }, { status: 400 });
    }

    // Buat semua order items sekaligus
    const createdItems = await prisma.$transaction(
      body.items.map((item) =>
        prisma.orderItem.create({
          data: {
            tableOrderId: order.id,
            productId: item.productId,
            productName: item.productName,
            productSku: item.productSku ?? null,
            variantSkuId: item.variantSkuId ?? null,
            variantLabel: item.variantLabel ?? null,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            note: item.note ?? null,
            status: "PENDING",
            modifiers: item.modifiers && item.modifiers.length > 0
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
