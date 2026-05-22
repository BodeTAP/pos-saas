import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SettingsClient } from "./settings-client";
import { NoTenant } from "@/components/ui/no-tenant";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user.tenantId) return <NoTenant />;

  const [tenant, staff] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: session.user.tenantId },
    }),
    prisma.user.findMany({
      where: { tenantId: session.user.tenantId, isActive: true, role: "KASIR" },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!tenant) return <NoTenant />;

  return <SettingsClient tenant={tenant} staff={staff} />;
}
