import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NoTenant } from "@/components/ui/no-tenant";
import { CustomersClient } from "./customers-client";

const PAGE_SIZE = 20;

export default async function CustomersPage() {
  const session = await auth();
  if (!session?.user.tenantId) return <NoTenant />;

  const [customers, total, tenant] = await Promise.all([
    prisma.customer.findMany({
      where: { tenantId: session.user.tenantId },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
    }),
    prisma.customer.count({
      where: { tenantId: session.user.tenantId },
    }),
    prisma.tenant.findUnique({
      where: { id: session.user.tenantId },
      select: { pointsPerAmount: true, pointValue: true },
    }),
  ]);

  return (
    <CustomersClient
      initialCustomers={customers}
      initialTotal={total}
      pointsPerAmount={tenant?.pointsPerAmount ?? 10000}
      pointValue={tenant?.pointValue ?? 100}
    />
  );
}
