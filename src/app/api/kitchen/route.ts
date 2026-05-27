import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getActiveOutletId } from "@/lib/active-outlet";

/**
 * GET /api/kitchen
 * Ambil:
 * 1. Semua meja dengan order aktif (OCCUPIED / BILL) beserta item pesanannya
 * 2. Semua takeaway orders (PAY_FIRST tanpa meja) yang masih ada item belum SERVED/CANCELLED
 * Polling-based — client poll setiap 10 detik.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const outletId = await getActiveOutletId();

    // 1. Meja aktif
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

    const tableResults = tables.map((table) => {
      const activeOrder = table.tableOrders[0] ?? null;
      const isPaid = !!activeOrder?.transactionId;
      return {
        kind: "TABLE" as const,
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
              isPaid,
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

    // 2. Takeaway orders (OrderItem dengan transactionId, bukan tableOrderId)
    // Filter: punya item yang belum SERVED/CANCELLED
    const takeawayItems = await prisma.orderItem.findMany({
      where: {
        tenantId: session.user.tenantId,
        tableOrderId: null,
        transactionId: { not: null },
        status: { not: "CANCELLED" },
        // Hanya tampilkan transaksi dari outlet aktif (jika ada)
        ...(outletId
          ? { transaction: { outletId } }
          : {}),
      },
      include: {
        modifiers: true,
        transaction: {
          select: {
            id: true,
            invoiceNumber: true,
            createdAt: true,
            outlet: { select: { name: true } },
          },
        },
      },
      orderBy: { sentAt: "asc" },
    });

    // Group by transactionId; hanya tampilkan transaksi yang masih punya item belum SERVED
    const takeawayMap = new Map<string, {
      transactionId: string;
      invoiceNumber: string;
      createdAt: Date;
      outletName: string;
      items: typeof takeawayItems;
    }>();

    for (const item of takeawayItems) {
      if (!item.transactionId || !item.transaction) continue;
      const tx = item.transaction;
      if (!takeawayMap.has(item.transactionId)) {
        takeawayMap.set(item.transactionId, {
          transactionId: item.transactionId,
          invoiceNumber: tx.invoiceNumber,
          createdAt: tx.createdAt,
          outletName: tx.outlet.name,
          items: [],
        });
      }
      takeawayMap.get(item.transactionId)!.items.push(item);
    }

    // Filter: hanya transaksi yang masih punya item belum SERVED
    const takeawayResults = Array.from(takeawayMap.values())
      .filter((tx) => tx.items.some((i) => i.status !== "SERVED"))
      .map((tx) => ({
        kind: "TAKEAWAY" as const,
        id: tx.transactionId,
        invoiceNumber: tx.invoiceNumber,
        outletName: tx.outletName,
        activeOrder: {
          id: tx.transactionId,
          openedAt: tx.createdAt,
          note: null,
          durationMinutes: Math.floor(
            (Date.now() - new Date(tx.createdAt).getTime()) / 60000
          ),
          items: tx.items.map((item) => ({
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
        },
      }));

    return NextResponse.json({
      tables: tableResults,
      takeaway: takeawayResults,
    });
  } catch (error) {
    console.error("Kitchen display error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
