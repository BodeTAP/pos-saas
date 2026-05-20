import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SettingsClient } from "./settings-client";
import { NoTenant } from "@/components/ui/no-tenant";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user.tenantId) return <NoTenant />;

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
  });

  if (!tenant) return <NoTenant />;

  return <SettingsClient tenant={tenant} />;
}
