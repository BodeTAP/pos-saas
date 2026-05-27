import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { NoTenant } from "@/components/ui/no-tenant";
import { TableDetailClient } from "./table-detail-client";

export default async function TableDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user.tenantId) return <NoTenant />;

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
    select: { businessType: true, serviceChargePct: true, taxRate: true, currency: true },
  });
  if (tenant?.businessType !== "FNB") redirect("/dashboard");

  const table = await prisma.table.findFirst({
    where: { id, tenantId: session.user.tenantId },
    include: {
      outlet: { select: { id: true, name: true } },
      tableOrders: {
        where: { closedAt: null },
        take: 1,
        orderBy: { openedAt: "desc" },
        include: {
          transaction: {
            select: {
              id: true,
              invoiceNumber: true,
              total: true,
              status: true,
              items: {
                select: {
                  id: true,
                  productName: true,
                  quantity: true,
                  unitPrice: true,
                  discount: true,
                  subtotal: true,
                  variantLabel: true,
                  modifiers: {
                    select: {
                      modifierGroupName: true,
                      modifierOptionName: true,
                      extraPrice: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!table) notFound();

  const activeOrder = table.tableOrders[0] ?? null;

  return (
    <TableDetailClient
      table={{
        id: table.id,
        number: table.number,
        name: table.name,
        area: table.area,
        capacity: table.capacity,
        status: table.status,
        outletId: table.outlet.id,
        outletName: table.outlet.name,
      }}
      activeOrder={
        activeOrder
          ? {
              id: activeOrder.id,
              openedAt: activeOrder.openedAt.toISOString(),
              note: activeOrder.note,
              transaction: activeOrder.transaction
                ? {
                    id: activeOrder.transaction.id,
                    invoiceNumber: activeOrder.transaction.invoiceNumber,
                    total: activeOrder.transaction.total,
                    status: activeOrder.transaction.status,
                    items: activeOrder.transaction.items.map((item) => ({
                      id: item.id,
                      productName: item.productName,
                      quantity: item.quantity,
                      unitPrice: item.unitPrice,
                      discount: item.discount,
                      subtotal: item.subtotal,
                      variantLabel: item.variantLabel,
                      modifiers: item.modifiers,
                    })),
                  }
                : null,
            }
          : null
      }
      serviceChargePct={tenant?.serviceChargePct ?? 0}
      taxRate={tenant?.taxRate ?? 0}
    />
  );
}
