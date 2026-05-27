import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NoTenant } from "@/components/ui/no-tenant";
import { redirect } from "next/navigation";
import { getActiveOutletId } from "@/lib/active-outlet";
import { TablesClient } from "./tables-client";

export default async function TablesPage() {
  const session = await auth();
  if (!session?.user.tenantId) return <NoTenant />;
  if (session.user.role !== "OWNER") redirect("/dashboard");

  // Cek businessType — halaman ini hanya untuk F&B
  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
    select: { businessType: true },
  });
  if (tenant?.businessType !== "FNB") {
    redirect("/dashboard");
  }

  const outletId = await getActiveOutletId();

  const tables = outletId
    ? await prisma.table.findMany({
        where: { outletId, tenantId: session.user.tenantId, isActive: true },
        include: {
          tableOrders: {
            where: { closedAt: null },
            select: { id: true, openedAt: true },
            take: 1,
          },
        },
        orderBy: [{ area: "asc" }, { number: "asc" }],
      })
    : [];

  return (
    <TablesClient
      initialTables={tables.map((t) => ({
        ...t,
        activeOrder: t.tableOrders[0] ?? null,
        tableOrders: undefined,
      }))}
      currentOutletId={outletId}
    />
  );
}
