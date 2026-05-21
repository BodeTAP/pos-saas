import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProductsClient } from "./products-client";
import { NoTenant } from "@/components/ui/no-tenant";
import { getActiveOutletId } from "@/lib/active-outlet";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await auth();
  if (!session?.user.tenantId) return <NoTenant />;

  const params = await searchParams;
  const page = parseInt(params.page || "1");
  const limit = 20;
  const outletId = await getActiveOutletId();

  const [productsRaw, categories, outlet, totalCount] = await Promise.all([
    prisma.product.findMany({
      where: { tenantId: session.user.tenantId },
      include: {
        category: true,
        outletStocks: outletId ? { where: { outletId }, take: 1 } : false,
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
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
    prisma.product.count({ where: { tenantId: session.user.tenantId } }),
  ]);

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
      totalCount={totalCount}
      currentPage={page}
      pageSize={limit}
    />
  );
}
