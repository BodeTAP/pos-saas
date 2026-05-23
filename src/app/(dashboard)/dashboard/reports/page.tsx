import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NoTenant } from "@/components/ui/no-tenant";
import { ReportsClient } from "./reports-client";

interface SearchParams {
  start?: string;
  end?: string;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  if (!session?.user.tenantId) return <NoTenant />;

  const params = await searchParams;
  const tenantId = session.user.tenantId;
  const outletId = session.user.outletId;

  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const defaultStart = new Date();
  defaultStart.setDate(defaultStart.getDate() - 29);
  defaultStart.setHours(0, 0, 0, 0);

  const startDate = params.start ? new Date(params.start) : defaultStart;
  const endDate = params.end ? new Date(params.end) : today;
  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(23, 59, 59, 999);

  const baseTxWhere = {
    tenantId,
    status: "COMPLETED" as const,
    createdAt: { gte: startDate, lte: endDate },
    ...(outletId && { outletId }),
  };

  const [summary, topProducts, dailyTransactions, cashierStats, grossProfitItems] =
    await Promise.all([
      prisma.transaction.aggregate({
        where: baseTxWhere,
        _sum: { total: true, subtotal: true },
        _count: true,
        _avg: { total: true },
      }),
      prisma.transactionItem.groupBy({
        by: ["productId", "productName"],
        where: { transaction: baseTxWhere },
        _sum: { quantity: true, subtotal: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 10,
      }),
      prisma.transaction.findMany({
        where: baseTxWhere,
        select: { total: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.transaction.groupBy({
        by: ["cashierId"],
        where: baseTxWhere,
        _sum: { total: true },
        _count: true,
        _avg: { total: true },
      }),
      // Laba kotor per produk: groupBy productId, sum subtotal
      // HPP dihitung via raw query terpisah karena Prisma tidak support SUM(a*b)
      prisma.transactionItem.groupBy({
        by: ["productId", "productName"],
        where: { transaction: baseTxWhere },
        _sum: { quantity: true, subtotal: true },
        orderBy: { _sum: { subtotal: "desc" } },
        take: 20,
      }),
    ]);

  // Ambil nama kasir
  const cashierIds = cashierStats.map((c) => c.cashierId);
  const cashiers = await prisma.user.findMany({
    where: { id: { in: cashierIds } },
    select: { id: true, name: true },
  });
  const cashierMap = Object.fromEntries(cashiers.map((c) => [c.id, c.name]));

  const cashierData = cashierStats
    .map((c) => ({
      cashierId: c.cashierId,
      cashierName: cashierMap[c.cashierId] || "Unknown",
      totalRevenue: c._sum.total || 0,
      totalTransactions: c._count,
      avgTransaction: c._avg.total || 0,
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue);

  // Group transaksi per hari
  const dayCount =
    Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const dailyMap = new Map<string, { revenue: number; count: number }>();
  for (let i = 0; i < dayCount; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    dailyMap.set(key, { revenue: 0, count: 0 });
  }
  for (const tx of dailyTransactions) {
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

  const topProductsData = topProducts.map((p) => ({
    name: p.productName,
    quantity: p._sum.quantity || 0,
    revenue: p._sum.subtotal || 0,
  }));

  // Hitung laba kotor per produk via raw query (HPP = SUM(buyPrice * quantity))
  // Prisma groupBy tidak support SUM(a*b), jadi kita ambil raw items
  const grossProfitData = grossProfitItems.map((p) => ({
    productId: p.productId,
    productName: p.productName,
    quantity: p._sum.quantity || 0,
    revenue: p._sum.subtotal || 0,
    cogs: 0,
    grossProfit: 0,
    marginPct: 0,
  }));

  if (grossProfitData.length > 0) {
    const productIds = grossProfitData.map((p) => p.productId);
    const rawItems = await prisma.transactionItem.findMany({
      where: {
        transaction: baseTxWhere,
        productId: { in: productIds },
      },
      select: { productId: true, buyPrice: true, quantity: true },
    });

    const cogsMap = new Map<string, number>();
    for (const item of rawItems) {
      const current = cogsMap.get(item.productId) || 0;
      cogsMap.set(item.productId, current + item.buyPrice * item.quantity);
    }

    for (const p of grossProfitData) {
      const cogs = cogsMap.get(p.productId) || 0;
      p.cogs = cogs;
      p.grossProfit = p.revenue - cogs;
      p.marginPct = p.revenue > 0 ? (p.grossProfit / p.revenue) * 100 : 0;
    }
  }

  // Total laba kotor: gunakan subtotal transaksi (sebelum pajak) sebagai revenue
  // agar konsisten dengan HPP yang dihitung dari item subtotal
  const totalRevenue = summary._sum.total || 0;
  const totalSubtotal = summary._sum.subtotal || 0;
  const allRawItems = await prisma.transactionItem.findMany({
    where: { transaction: baseTxWhere },
    select: { buyPrice: true, quantity: true },
  });
  const totalCogs = allRawItems.reduce((sum, i) => sum + i.buyPrice * i.quantity, 0);
  // Laba kotor dihitung dari subtotal (sebelum pajak & diskon transaksi)
  // karena HPP tidak terpengaruh pajak
  const totalGrossProfit = totalSubtotal - totalCogs;
  const totalMarginPct = totalSubtotal > 0 ? (totalGrossProfit / totalSubtotal) * 100 : 0;

  return (
    <ReportsClient
      summary={{
        totalRevenue,
        totalTransactions: summary._count,
        avgTransaction: summary._avg.total || 0,
        totalCogs,
        totalGrossProfit,
        totalMarginPct,
      }}
      dailyData={dailyData}
      topProducts={topProductsData}
      cashierData={cashierData}
      grossProfitData={grossProfitData}
      startDate={startDate.toISOString().slice(0, 10)}
      endDate={endDate.toISOString().slice(0, 10)}
    />
  );
}
