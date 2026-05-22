import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NoTenant } from "@/components/ui/no-tenant";
import { getActiveOutletId } from "@/lib/active-outlet";
import { InventoryClient } from "./inventory-client";

export default async function InventoryPage() {
  const session = await auth();
  if (!session?.user.tenantId) return <NoTenant />;

  const outletId = await getActiveOutletId();

  const [outlets, lowStockData] = await Promise.all([
    prisma.outlet.findMany({
      where: { tenantId: session.user.tenantId, isActive: true },
      select: { id: true, name: true, isMain: true },
      orderBy: [{ isMain: "desc" }, { name: "asc" }],
    }),
    outletId
      ? prisma.outletStock.findMany({
          where: {
            tenantId: session.user.tenantId,
            outletId,
            product: { isActive: true },
          },
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                unit: true,
                category: { select: { name: true } },
              },
            },
          },
          orderBy: { stock: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const lowStockItems = lowStockData
    .filter((s) => s.stock <= s.minStock)
    .map((s) => ({
      productId: s.productId,
      productName: s.product.name,
      productSku: s.product.sku,
      productUnit: s.product.unit,
      categoryName: s.product.category?.name ?? null,
      stock: s.stock,
      minStock: s.minStock,
      status: s.stock === 0 ? ("OUT_OF_STOCK" as const) : ("LOW_STOCK" as const),
    }));

  const activeOutlet = outlets.find((o) => o.id === outletId) ?? outlets[0] ?? null;

  return (
    <InventoryClient
      outlets={outlets}
      activeOutlet={activeOutlet}
      initialLowStockItems={lowStockItems}
    />
  );
}
