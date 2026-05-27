import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NoTenant } from "@/components/ui/no-tenant";
import { redirect } from "next/navigation";
import { getActiveOutletId } from "@/lib/active-outlet";
import { TablesClient } from "./tables-client";

export default async function TablesPage() {
  const session = await auth();
  if (!session?.user.tenantId) return <NoTenant />;
  if (!["OWNER", "KASIR"].includes(session.user.role)) redirect("/dashboard");

  // Cek businessType — halaman ini hanya untuk F&B
  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
    select: { businessType: true },
  });
  if (tenant?.businessType !== "FNB") {
    redirect("/dashboard");
  }

  const outletId = await getActiveOutletId();

  // Jika tidak ada outlet aktif, coba ambil outlet utama langsung
  const resolvedOutletId = outletId ?? await prisma.outlet.findFirst({
    where: { tenantId: session.user.tenantId, isMain: true, isActive: true },
    select: { id: true },
  }).then((o) => o?.id ?? null);

  const tables = resolvedOutletId
    ? await prisma.table.findMany({
        where: { outletId: resolvedOutletId, tenantId: session.user.tenantId, isActive: true },
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
      currentOutletId={resolvedOutletId}
      isOwner={session.user.role === "OWNER"}
    />
  );
}
