import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NoTenant } from "@/components/ui/no-tenant";
import { StaffClient } from "./staff-client";

export default async function StaffPage() {
  const session = await auth();
  if (!session?.user.tenantId) return <NoTenant />;

  const [staff, tenant, outlets] = await Promise.all([
    prisma.user.findMany({
      where: { tenantId: session.user.tenantId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        outletId: true,
        outlet: { select: { name: true } },
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.tenant.findUnique({
      where: { id: session.user.tenantId },
      select: { maxCashiers: true, plan: true },
    }),
    prisma.outlet.findMany({
      where: { tenantId: session.user.tenantId, isActive: true },
      select: { id: true, name: true, isMain: true },
      orderBy: [{ isMain: "desc" }, { name: "asc" }],
    }),
  ]);

  return (
    <StaffClient
      initialStaff={staff}
      maxCashiers={tenant?.maxCashiers || 1}
      plan={tenant?.plan || "FREE"}
      outlets={outlets}
    />
  );
}
