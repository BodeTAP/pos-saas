import { prisma } from "@/lib/prisma";
import { BillingGlobalClient } from "./billing-client";
import type { BillingStatus } from "@prisma/client";

interface SearchParams {
  status?: string;
  start?: string;
  end?: string;
}

export default async function GlobalBillingPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const status = params.status || "ALL";

  // Default 30 hari
  const endDate = params.end ? new Date(params.end) : new Date();
  const defaultStartDate = new Date();
  defaultStartDate.setDate(defaultStartDate.getDate() - 30);
  const startDate = params.start ? new Date(params.start) : defaultStartDate;
  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(23, 59, 59, 999);

  const whereClause = {
    createdAt: { gte: startDate, lte: endDate },
    ...(status !== "ALL" && { status: status as BillingStatus }),
  };

  const [invoices, summary, paidSummary] = await Promise.all([
    prisma.billingInvoice.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { tenant: { select: { name: true, slug: true } } },
    }),
    prisma.billingInvoice.aggregate({
      where: whereClause,
      _count: true,
      _sum: { amount: true },
    }),
    prisma.billingInvoice.aggregate({
      where: { ...whereClause, status: "PAID" },
      _count: true,
      _sum: { amount: true },
    }),
  ]);

  return (
    <BillingGlobalClient
      invoices={invoices}
      totalCount={summary._count}
      totalAmount={summary._sum.amount || 0}
      paidCount={paidSummary._count}
      paidAmount={paidSummary._sum.amount || 0}
      filters={{
        status,
        start: startDate.toISOString().slice(0, 10),
        end: endDate.toISOString().slice(0, 10),
      }}
    />
  );
}
