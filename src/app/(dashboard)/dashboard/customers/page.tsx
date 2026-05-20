import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NoTenant } from "@/components/ui/no-tenant";
import { CustomersClient } from "./customers-client";

export default async function CustomersPage() {
  const session = await auth();
  if (!session?.user.tenantId) return <NoTenant />;

  const customers = await prisma.customer.findMany({
    where: { tenantId: session.user.tenantId },
    orderBy: { createdAt: "desc" },
  });

  return <CustomersClient initialCustomers={customers} />;
}
