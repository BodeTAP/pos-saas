import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NoTenant } from "@/components/ui/no-tenant";
import { BillingClient } from "./billing-client";
import { getAllPlans } from "@/lib/plans";

export default async function BillingPage() {
  const session = await auth();
  if (!session?.user.tenantId) return <NoTenant />;

  const [tenant, invoices, plans] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: session.user.tenantId },
      select: {
        plan: true,
        subscriptionStatus: true,
        trialEndsAt: true,
        subscriptionEndsAt: true,
      },
    }),
    prisma.billingInvoice.findMany({
      where: { tenantId: session.user.tenantId },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    getAllPlans(),
  ]);

  if (!tenant) return null;

  return <BillingClient tenant={tenant} invoices={invoices} plans={plans} />;
}
