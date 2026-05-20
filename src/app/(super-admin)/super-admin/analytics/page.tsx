import { prisma } from "@/lib/prisma";
import { AnalyticsClient } from "./analytics-client";

export default async function PlatformAnalyticsPage() {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 89);
  ninetyDaysAgo.setHours(0, 0, 0, 0);

  const [
    revenueAggregate,
    transactionCount,
    tenantsByPlan,
    tenantsByStatus,
    topTenants,
    invoicesInPeriod,
    newTenantsInPeriod,
  ] = await Promise.all([
    prisma.billingInvoice.aggregate({
      where: { status: "PAID" },
      _sum: { amount: true },
    }),
    prisma.transaction.count({ where: { status: "COMPLETED" } }),
    prisma.tenant.groupBy({ by: ["plan"], _count: true }),
    prisma.tenant.groupBy({ by: ["subscriptionStatus"], _count: true }),
    prisma.tenant.findMany({
      take: 10,
      include: { _count: { select: { transactions: true } } },
      orderBy: { transactions: { _count: "desc" } },
    }),
    prisma.billingInvoice.findMany({
      where: {
        status: "PAID",
        paidAt: { gte: ninetyDaysAgo },
      },
      select: { amount: true, paidAt: true, plan: true },
      orderBy: { paidAt: "asc" },
    }),
    prisma.tenant.findMany({
      where: { createdAt: { gte: ninetyDaysAgo } },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  // Group revenue per hari (90 hari)
  const revenueMap = new Map<string, number>();
  const tenantMap = new Map<string, number>();
  for (let i = 0; i < 90; i++) {
    const d = new Date(ninetyDaysAgo);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    revenueMap.set(key, 0);
    tenantMap.set(key, 0);
  }
  for (const inv of invoicesInPeriod) {
    if (!inv.paidAt) continue;
    const key = inv.paidAt.toISOString().slice(0, 10);
    revenueMap.set(key, (revenueMap.get(key) || 0) + inv.amount);
  }
  for (const t of newTenantsInPeriod) {
    const key = t.createdAt.toISOString().slice(0, 10);
    tenantMap.set(key, (tenantMap.get(key) || 0) + 1);
  }

  const trendData = Array.from(revenueMap.entries()).map(([date, revenue]) => ({
    date,
    label: new Date(date).toLocaleDateString("id-ID", { day: "2-digit", month: "short" }),
    revenue,
    newTenants: tenantMap.get(date) || 0,
  }));

  return (
    <AnalyticsClient
      summary={{
        totalRevenue: revenueAggregate._sum.amount || 0,
        totalTransactions: transactionCount,
      }}
      tenantsByPlan={tenantsByPlan.map((t) => ({ plan: t.plan, count: t._count }))}
      tenantsByStatus={tenantsByStatus.map((t) => ({
        status: t.subscriptionStatus,
        count: t._count,
      }))}
      topTenants={topTenants.map((t) => ({
        id: t.id,
        name: t.name,
        plan: t.plan,
        transactions: t._count.transactions,
      }))}
      trendData={trendData}
    />
  );
}
