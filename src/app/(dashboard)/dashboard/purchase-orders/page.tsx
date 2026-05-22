import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NoTenant } from "@/components/ui/no-tenant";
import { PurchaseOrdersClient } from "./purchase-orders-client";

export default async function PurchaseOrdersPage() {
  const session = await auth();
  if (!session?.user.tenantId) return <NoTenant />;

  const [ordersRaw, outlets] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where: { tenantId: session.user.tenantId },
      include: {
        outlet: { select: { name: true } },
        items: { select: { quantity: true, quantityReceived: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.outlet.findMany({
      where: { tenantId: session.user.tenantId, isActive: true },
      select: { id: true, name: true, isMain: true },
      orderBy: [{ isMain: "desc" }, { name: "asc" }],
    }),
  ]);

  const orders = ordersRaw.map((o) => ({
    ...o,
    itemCount: o.items.length,
    totalQty: o.items.reduce((s, i) => s + i.quantity, 0),
    receivedQty: o.items.reduce((s, i) => s + i.quantityReceived, 0),
    items: undefined,
  }));

  return <PurchaseOrdersClient initialOrders={orders} outlets={outlets} />;
}
