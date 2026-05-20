import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NoTenant } from "@/components/ui/no-tenant";
import { OutletsClient } from "./outlets-client";

export default async function OutletsPage() {
  const session = await auth();
  if (!session?.user.tenantId) return <NoTenant />;

  const [outlets, tenant] = await Promise.all([
    prisma.outlet.findMany({
      where: { tenantId: session.user.tenantId },
      include: {
        _count: { select: { users: true, transactions: true } },
      },
      orderBy: [{ isMain: "desc" }, { createdAt: "asc" }],
    }),
    prisma.tenant.findUnique({
      where: { id: session.user.tenantId },
      select: { maxOutlets: true, plan: true },
    }),
  ]);

  return (
    <OutletsClient
      initialOutlets={outlets}
      maxOutlets={tenant?.maxOutlets || 1}
      plan={tenant?.plan || "FREE"}
    />
  );
}
