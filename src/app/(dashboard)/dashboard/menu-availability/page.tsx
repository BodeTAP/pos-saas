import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { NoTenant } from "@/components/ui/no-tenant";
import { MenuAvailabilityClient } from "./menu-availability-client";

export default async function MenuAvailabilityPage() {
  const session = await auth();
  if (!session?.user.tenantId) return <NoTenant />;
  if (session.user.role !== "OWNER") redirect("/dashboard");

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
    select: { businessType: true },
  });
  if (tenant?.businessType !== "FNB") redirect("/dashboard");

  const products = await prisma.product.findMany({
    where: { tenantId: session.user.tenantId, isActive: true },
    select: {
      id: true,
      name: true,
      imageUrl: true,
      sellPrice: true,
      availableToday: true,
      category: { select: { id: true, name: true } },
    },
    orderBy: [{ categoryId: "asc" }, { name: "asc" }],
  });

  const categories = await prisma.category.findMany({
    where: { tenantId: session.user.tenantId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <MenuAvailabilityClient
      initialProducts={products.map((p) => ({
        id: p.id,
        name: p.name,
        imageUrl: p.imageUrl,
        sellPrice: p.sellPrice,
        availableToday: p.availableToday,
        categoryId: p.category?.id ?? null,
        categoryName: p.category?.name ?? "Tanpa Kategori",
      }))}
      categories={categories}
    />
  );
}
