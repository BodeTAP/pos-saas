import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getActiveOutletId } from "@/lib/active-outlet";

/**
 * GET /api/kitchen
 * Ambil semua meja dengan order aktif (OCCUPIED / BILL) beserta item pesanannya.
 * Polling-based — client poll setiap 10 detik.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const outletId = await getActiveOutletId();

    const tables = await prisma.table.findMany({
      where: {
        tenantId: session.user.tenantId,
        isActive: true,
        status: { in: ["OCCUPIED", "BILL"] },
        ...(outletId ? { outletId } : {}),
      },
      include: {
        tableOrders: {
          where: { closedAt: null },
          take: 1,
          orderBy: { openedAt: "desc" },
          include: {
            items: {
              where: { status: { not: "CANCELLED" } },
              include: { modifiers: true },
              orderBy: { sentAt: "asc" },
            },
          },
        },
        outlet: { select: { name: true } },
      },
      orderBy: [{ area: "asc" }, { number: "asc" }],
    });

    const result = tables.map((table) => {
      const activeOrder = table.tableOrders[0] ?? null;
      return {
        id: table.id,
        number: table.number,
        name: table.name,
        area: table.area,
        capacity: table.capacity,
        status: table.status,
        outletName: table.outlet.name,
        activeOrder: activeOrder
          ? {
              id: activeOrder.id,
              openedAt: activeOrder.openedAt,
              note: activeOrder.note,
              durationMinutes: Math.floor(
                (Date.now() - new Date(activeOrder.openedAt).getTime()) / 60000
              ),
              items: activeOrder.items.map((item) => ({
                id: item.id,
                status: item.status,
                productName: item.productName,
                variantLabel: item.variantLabel,
                quantity: item.quantity,
                note: item.note,
                sentAt: item.sentAt,
                cookedAt: item.cookedAt,
                readyAt: item.readyAt,
                servedAt: item.servedAt,
                modifiers: item.modifiers.map((m) => ({
                  groupName: m.modifierGroupName,
                  optionName: m.modifierOptionName,
                })),
              })),
            }
          : null,
      };
    });

    return NextResponse.json({ tables: result });
  } catch (error) {
    console.error("Kitchen display error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
