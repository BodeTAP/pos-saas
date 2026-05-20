import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProductsClient } from "./products-client";
import { NoTenant } from "@/components/ui/no-tenant";
import { getActiveOutletId } from "@/lib/active-outlet";

export default async function ProductsPage() {
  const session = await auth();
  if (!session?.user.tenantId) return <NoTenant />;

  const outletId = await getActiveOutletId();

  const [productsRaw, categories, outlet] = await Promise.all([
    prisma.product.findMany({
      where: { tenantId: session.user.tenantId },
      include: {
        category: true,
        outletStocks: outletId ? { where: { outletId }, take: 1 } : false,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.category.findMany({
      where: { tenantId: session.user.tenantId },
      orderBy: { name: "asc" },
    }),
    outletId
      ? prisma.outlet.findUnique({
          where: { id: outletId },
          select: { id: true, name: true, isMain: true },
        })
      : Promise.resolve(null),
  ]);

  // Override stock & minStock dengan data dari OutletStock outlet aktif
  const products = productsRaw.map((p) => {
    const outletStock = p.outletStocks?.[0];
    return {
      ...p,
      stock: outletStock?.stock ?? 0,
      minStock: outletStock?.minStock ?? p.minStock,
      outletStocks: undefined,
    };
  });

  return (
    <ProductsClient
      initialProducts={products}
      categories={categories}
      tenantId={session.user.tenantId}
      outlet={outlet}
    />
  );
}
