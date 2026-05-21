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

  const [summary, topProducts, dailyTransactions, cashierStats] = await Promise.all([
    prisma.transaction.aggregate({
      where: baseTxWhere,
      _sum: { total: true },
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

  return (
    <ReportsClient
      summary={{
        totalRevenue: summary._sum.total || 0,
        totalTransactions: summary._count,
        avgTransaction: summary._avg.total || 0,
      }}
      dailyData={dailyData}
      topProducts={topProductsData}
      cashierData={cashierData}
      startDate={startDate.toISOString().slice(0, 10)}
      endDate={endDate.toISOString().slice(0, 10)}
    />
  );
}
