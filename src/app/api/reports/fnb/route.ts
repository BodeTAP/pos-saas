import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getActiveOutletId } from "@/lib/active-outlet";

/**
 * GET /api/reports/fnb
 * Laporan F&B: revenue per meja, item terlaris, rata-rata durasi duduk.
 * Query params: start, end, outletId (optional)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user.tenantId || session.user.role !== "OWNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    // Pakai active outlet (cookie) — fallback ke session.user.outletId, lalu null
    const outletId = searchParams.get("outletId") || (await getActiveOutletId());

    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const defaultStart = new Date();
    defaultStart.setDate(defaultStart.getDate() - 29);
    defaultStart.setHours(0, 0, 0, 0);

    const startDate = searchParams.get("start")
      ? new Date(searchParams.get("start")!)
      : defaultStart;
    const endDate = searchParams.get("end")
      ? new Date(searchParams.get("end")!)
      : today;
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    // Cek apakah tenant pakai PaymentFlow PAY_FIRST (untuk include takeaway)
    const tenantInfo = await prisma.tenant.findUnique({
      where: { id: session.user.tenantId },
      select: { paymentFlow: true },
    });
    const isPayFirst = tenantInfo?.paymentFlow === "PAY_FIRST";

    // Base where: F&B = transaksi dengan tableOrderId (dine-in)
    // ATAU transaksi dengan OrderItem (takeaway PAY_FIRST)
    const baseTxWhere = {
      tenantId: session.user.tenantId,
      status: "COMPLETED" as const,
      createdAt: { gte: startDate, lte: endDate },
      ...(outletId ? { outletId } : {}),
      OR: [
        { tableOrderId: { not: null } }, // dine-in
        ...(isPayFirst ? [{ orderItems: { some: {} } }] : []), // takeaway PAY_FIRST
      ],
    };

    // 1. Revenue per area meja
    const txWithTable = await prisma.transaction.findMany({
      where: baseTxWhere,
      select: {
        id: true,
        total: true,
        createdAt: true,
        tableOrder: {
          select: {
            openedAt: true,
            closedAt: true,
            table: { select: { number: true, area: true, name: true } },
          },
        },
      },
    });

    // Revenue per area
    const areaMap = new Map<string, { revenue: number; count: number; totalDuration: number; durationCount: number }>();
    for (const tx of txWithTable) {
      // Takeaway tidak punya tableOrder → masuk ke "Takeaway"
      const area = tx.tableOrder
        ? (tx.tableOrder.table.area || "Umum")
        : "Takeaway";
      const current = areaMap.get(area) || { revenue: 0, count: 0, totalDuration: 0, durationCount: 0 };
      current.revenue += tx.total;
      current.count += 1;
      // Hitung durasi duduk (menit) — hanya untuk dine-in
      if (tx.tableOrder?.openedAt && tx.tableOrder?.closedAt) {
        const duration = Math.floor(
          (new Date(tx.tableOrder.closedAt).getTime() - new Date(tx.tableOrder.openedAt).getTime()) / 60000
        );
        if (duration > 0 && duration < 480) { // filter outlier > 8 jam
          current.totalDuration += duration;
          current.durationCount += 1;
        }
      }
      areaMap.set(area, current);
    }

    const revenueByArea = Array.from(areaMap.entries())
      .map(([area, data]) => ({
        area,
        revenue: data.revenue,
        transactions: data.count,
        avgDurationMinutes: data.durationCount > 0
          ? Math.round(data.totalDuration / data.durationCount)
          : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    // 2. Item terlaris F&B
    const topItems = await prisma.transactionItem.groupBy({
      by: ["productId", "productName"],
      where: { transaction: baseTxWhere },
      _sum: { quantity: true, subtotal: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 10,
    });

    // 3. Revenue per hari (F&B only)
    const dayCount = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    ) + 1;
    const dailyMap = new Map<string, { revenue: number; count: number }>();
    for (let i = 0; i < dayCount; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      dailyMap.set(d.toISOString().slice(0, 10), { revenue: 0, count: 0 });
    }
    for (const tx of txWithTable) {
      const key = tx.createdAt.toISOString().slice(0, 10);
      const current = dailyMap.get(key);
      if (current) {
        current.revenue += tx.total;
        current.count += 1;
      }
    }
    const dailyData = Array.from(dailyMap.entries()).map(([date, val]) => ({
      date,
      label: new Date(date).toLocaleDateString("id-ID", { day: "2-digit", month: "short" }),
      revenue: val.revenue,
      count: val.count,
    }));

    // 4. Summary
    const totalRevenue = txWithTable.reduce((s, t) => s + t.total, 0);
    const totalTransactions = txWithTable.length;
    const avgTransaction = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

    // Rata-rata durasi duduk keseluruhan
    const allDurations = txWithTable
      .filter((tx) => tx.tableOrder?.openedAt && tx.tableOrder?.closedAt)
      .map((tx) =>
        Math.floor(
          (new Date(tx.tableOrder!.closedAt!).getTime() -
            new Date(tx.tableOrder!.openedAt).getTime()) / 60000
        )
      )
      .filter((d) => d > 0 && d < 480);
    const avgDuration = allDurations.length > 0
      ? Math.round(allDurations.reduce((s, d) => s + d, 0) / allDurations.length)
      : 0;

    return NextResponse.json({
      summary: {
        totalRevenue,
        totalTransactions,
        avgTransaction,
        avgDurationMinutes: avgDuration,
      },
      revenueByArea,
      topItems: topItems.map((i) => ({
        productName: i.productName,
        quantity: i._sum.quantity || 0,
        revenue: i._sum.subtotal || 0,
      })),
      dailyData,
      startDate: startDate.toISOString().slice(0, 10),
      endDate: endDate.toISOString().slice(0, 10),
    });
  } catch (error) {
    console.error("F&B reports error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
