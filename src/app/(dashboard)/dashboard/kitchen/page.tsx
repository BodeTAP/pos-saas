import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { NoTenant } from "@/components/ui/no-tenant";
import { KitchenDisplayClient } from "./kitchen-client";
import { getActiveOutletId } from "@/lib/active-outlet";

export default async function KitchenPage() {
  const session = await auth();
  if (!session?.user.tenantId) return <NoTenant />;

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
    select: { businessType: true },
  });
  if (tenant?.businessType !== "FNB") redirect("/dashboard");

  const outletId = await getActiveOutletId();

  const tables = await prisma.table.findMany({
    where: {
      tenantId: session.user.tenantId,
      isActive: true,
      status: { in: ["OCCUPIED", "BILL"] },
      ...(outletId ? { outletId } : {}),
    },
    include: {
      tableOrders: {
        where: { closedAt: null },
        take: 1,
        orderBy: { openedAt: "desc" },
        include: {
          items: {
            where: { status: { not: "CANCELLED" } },
            include: { modifiers: true },
            orderBy: { sentAt: "asc" },
          },
        },
      },
      outlet: { select: { name: true } },
    },
    orderBy: [{ area: "asc" }, { number: "asc" }],
  });

  const initialTables = tables.map((t) => {
    const order = t.tableOrders[0] ?? null;
    return {
      id: t.id,
      number: t.number,
      name: t.name,
      area: t.area,
      capacity: t.capacity,
      status: t.status as "OCCUPIED" | "BILL",
      outletName: t.outlet.name,
      activeOrder: order
        ? {
            id: order.id,
            openedAt: order.openedAt.toISOString(),
            note: order.note,
            durationMinutes: Math.floor(
              (Date.now() - order.openedAt.getTime()) / 60000
            ),
            items: order.items.map((item) => ({
              id: item.id,
              status: item.status as "PENDING" | "COOKING" | "READY" | "SERVED" | "CANCELLED",
              productName: item.productName,
              variantLabel: item.variantLabel,
              quantity: item.quantity,
              note: item.note,
              sentAt: item.sentAt.toISOString(),
              cookedAt: item.cookedAt?.toISOString() ?? null,
              readyAt: item.readyAt?.toISOString() ?? null,
              servedAt: item.servedAt?.toISOString() ?? null,
              modifiers: item.modifiers.map((m) => ({
                groupName: m.modifierGroupName,
                optionName: m.modifierOptionName,
              })),
            })),
          }
        : null,
    };
  });

  return <KitchenDisplayClient initialTables={initialTables} />;
}
