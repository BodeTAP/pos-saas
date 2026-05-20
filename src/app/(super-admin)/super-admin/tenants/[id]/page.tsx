import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TenantDetailClient } from "./tenant-detail-client";

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const tenant = await prisma.tenant.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          users: true,
          products: true,
          transactions: true,
          customers: true,
          outlets: true,
        },
      },
      users: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      },
      outlets: {
        select: {
          id: true,
          name: true,
          isMain: true,
          isActive: true,
          createdAt: true,
        },
      },
      billingInvoices: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  if (!tenant) notFound();

  const revenue = await prisma.transaction.aggregate({
    where: { tenantId: id, status: "COMPLETED" },
    _sum: { total: true },
  });

  return (
    <TenantDetailClient
      tenant={tenant}
      totalRevenue={revenue._sum.total || 0}
    />
  );
}
