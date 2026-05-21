import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NoTenant } from "@/components/ui/no-tenant";
import { CategoriesClient } from "./categories-client";

export default async function CategoriesPage() {
  const session = await auth();
  if (!session?.user.tenantId) return <NoTenant />;

  const categories = await prisma.category.findMany({
    where: { tenantId: session.user.tenantId },
    include: { _count: { select: { products: true } } },
    orderBy: { name: "asc" },
  });

  return <CategoriesClient initialCategories={categories} />;
}
