import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { NoTenant } from "@/components/ui/no-tenant";
import { ModifiersClient } from "./modifiers-client";

export default async function ModifiersPage() {
  const session = await auth();
  if (!session?.user.tenantId) return <NoTenant />;
  if (session.user.role !== "OWNER") redirect("/dashboard");

  // Hanya untuk F&B
  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
    select: { businessType: true },
  });
  if (tenant?.businessType !== "FNB") redirect("/dashboard");

  const groups = await prisma.modifierGroup.findMany({
    where: { tenantId: session.user.tenantId },
    include: {
      options: { orderBy: { position: "asc" } },
      _count: { select: { products: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const products = await prisma.product.findMany({
    where: { tenantId: session.user.tenantId, isActive: true },
    select: {
      id: true,
      name: true,
      modifierGroups: { select: { groupId: true } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <ModifiersClient
      initialGroups={groups.map((g) => ({
        id: g.id,
        name: g.name,
        required: g.required,
        multiple: g.multiple,
        minSelect: g.minSelect,
        maxSelect: g.maxSelect,
        productCount: g._count.products,
        options: g.options.map((o) => ({
          id: o.id,
          name: o.name,
          extraPrice: o.extraPrice,
          isDefault: o.isDefault,
          position: o.position,
        })),
      }))}
      products={products.map((p) => ({
        id: p.id,
        name: p.name,
        assignedGroupIds: p.modifierGroups.map((mg) => mg.groupId),
      }))}
    />
  );
}
