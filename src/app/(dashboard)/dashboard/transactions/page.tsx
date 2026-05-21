import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NoTenant } from "@/components/ui/no-tenant";
import { TransactionsClient } from "./transactions-client";

export default async function TransactionsPage() {
  const session = await auth();
  if (!session?.user.tenantId) return <NoTenant />;

  const [transactions, outlets, tenant] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        tenantId: session.user.tenantId,
        status: { in: ["COMPLETED", "CANCELLED"] },
      },
      include: {
        cashier: { select: { name: true } },
        outlet: { select: { id: true, name: true } },
        customer: { select: { name: true } },
        items: true,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.outlet.findMany({
      where: { tenantId: session.user.tenantId, isActive: true },
      select: { id: true, name: true, isMain: true },
      orderBy: [{ isMain: "desc" }, { name: "asc" }],
    }),
    prisma.tenant.findUnique({
      where: { id: session.user.tenantId },
      select: { name: true, address: true, phone: true, receiptWidth: true, receiptNote: true },
    }),
  ]);

  return (
    <TransactionsClient
      initialTransactions={transactions}
      outlets={outlets}
      tenant={tenant}
      isOwner={session.user.role === "OWNER"}
    />
  );
}
