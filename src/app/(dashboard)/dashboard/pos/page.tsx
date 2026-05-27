import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { POSInterface } from "@/components/pos/pos-interface";
import { NoTenant } from "@/components/ui/no-tenant";
import { getActiveOutletId } from "@/lib/active-outlet";
import { AlertCircle } from "lucide-react";

export default async function POSPage({
  searchParams,
}: {
  searchParams: Promise<{ tableId?: string }>;
}) {
  const session = await auth();
  if (!session?.user.tenantId) return <NoTenant />;

  const outletId = await getActiveOutletId();
  if (!outletId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <AlertCircle className="w-12 h-12 text-orange-500 mb-3" />
        <h2 className="text-lg font-semibold text-gray-700 mb-1">
          Cabang Tidak Ditemukan
        </h2>
        <p className="text-sm text-gray-500 max-w-sm">
          Akun Anda belum terhubung ke cabang manapun. Hubungi pemilik toko.
        </p>
      </div>
    );
  }

  const { tableId: initialTableId } = await searchParams;

  // Ambil produk dengan stok di outlet aktif + varian
  // F&B: filter availableToday = true jika businessType FNB
  const tenantBizType = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
    select: { businessType: true },
  });
  const isFnB = tenantBizType?.businessType === "FNB";

  const productsRaw = await prisma.product.findMany({
    where: {
      tenantId: session.user.tenantId,
      isActive: true,
      ...(isFnB ? { availableToday: true } : {}),
    },
    include: {
      category: true,
      outletStocks: { where: { outletId }, take: 1 },
      variantTypes: {
        include: { options: { orderBy: { createdAt: "asc" } } },
        orderBy: { position: "asc" },
      },
      variantSKUs: {
        where: { isActive: true },
        include: {
          options: {
            include: { option: { include: { variantType: true } } },
          },
          outletStocks: { where: { outletId }, take: 1 },
        },
      },
      // F&B: modifier groups
      modifierGroups: {
        include: {
          group: {
            include: {
              options: { orderBy: { position: "asc" } },
            },
          },
        },
        orderBy: { position: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  // Transform produk
  const products = productsRaw.map((p) => {
    const outletStock = p.outletStocks[0];
    const variantSKUs = p.variantSKUs.map((sku) => ({
      id: sku.id,
      sku: sku.sku,
      price: sku.price,
      buyPrice: sku.buyPrice,
      imageUrl: sku.imageUrl,
      isActive: sku.isActive,
      stock: sku.outletStocks[0]?.stock ?? 0,
      minStock: sku.outletStocks[0]?.minStock ?? 5,
      label: sku.options
        .sort((a, b) => a.option.variantType.position - b.option.variantType.position)
        .map((o) => o.option.name)
        .join(" / "),
      optionIds: sku.options.map((o) => o.optionId),
    }));

    return {
      ...p,
      stock: outletStock?.stock ?? 0,
      minStock: outletStock?.minStock ?? p.minStock,
      outletStocks: undefined,
      variantSKUs,
      // F&B: modifier groups
      modifierGroups: p.modifierGroups.map((pmg) => ({
        id: pmg.group.id,
        name: pmg.group.name,
        required: pmg.group.required,
        multiple: pmg.group.multiple,
        minSelect: pmg.group.minSelect,
        maxSelect: pmg.group.maxSelect,
        options: pmg.group.options.map((o) => ({
          id: o.id,
          name: o.name,
          extraPrice: o.extraPrice,
          isDefault: o.isDefault,
        })),
      })),
    };
  });

  const [categories, tenantData, outlet] = await Promise.all([
    prisma.category.findMany({
      where: { tenantId: session.user.tenantId },
      orderBy: { name: "asc" },
    }),
    prisma.tenant.findUnique({
      where: { id: session.user.tenantId },
      select: {
        taxRate: true,
        currency: true,
        name: true,
        address: true,
        phone: true,
        receiptWidth: true,
        receiptNote: true,
        receiptHeader: true,
        pointsPerAmount: true,
        pointValue: true,
        activePaymentMethods: true,
        invoicePrefix: true,
        businessType: true, // ambil sekaligus
        serviceChargePct: true, // F&B service charge
        paymentFlow: true, // F&B payment flow
        autoPrintKitchen: true, // F&B auto-print struk dapur
      },
    }),
    prisma.outlet.findUnique({
      where: { id: outletId },
      select: { id: true, name: true, isMain: true },
    }),
  ]);

  const businessType = tenantData?.businessType ?? "RETAIL";

  // Pisahkan tenant info dari businessType
  const tenant = tenantData
    ? {
        taxRate: tenantData.taxRate,
        currency: tenantData.currency,
        name: tenantData.name,
        address: tenantData.address,
        phone: tenantData.phone,
        receiptWidth: tenantData.receiptWidth,
        receiptNote: tenantData.receiptNote,
        receiptHeader: tenantData.receiptHeader,
        pointsPerAmount: tenantData.pointsPerAmount,
        pointValue: tenantData.pointValue,
        activePaymentMethods: tenantData.activePaymentMethods,
        invoicePrefix: tenantData.invoicePrefix,
        serviceChargePct: tenantData.serviceChargePct,
        paymentFlow: tenantData.paymentFlow,
        autoPrintKitchen: tenantData.autoPrintKitchen,
      }
    : null;

  // Ambil meja untuk F&B — paralel dengan query di atas sudah selesai
  const tables = businessType === "FNB"
    ? await prisma.table.findMany({
        where: { outletId, tenantId: session.user.tenantId, isActive: true },
        include: {
          tableOrders: {
            where: { closedAt: null },
            select: { id: true, openedAt: true },
            take: 1,
          },
        },
        orderBy: [{ area: "asc" }, { number: "asc" }],
      }).then((ts) => ts.map((t) => ({
        id: t.id,
        number: t.number,
        name: t.name,
        capacity: t.capacity,
        area: t.area,
        status: t.status,
        activeOrderId: t.tableOrders[0]?.id ?? null,
      })))
    : [];

  // F&B: jika ada ?tableId=, fetch order items dari dapur untuk pre-fill keranjang
  type InitialCartItem = {
    productId: string;
    productName: string;
    productSku: string | null;
    variantSkuId: string | null;
    variantLabel: string | null;
    quantity: number;
    unitPrice: number;
    modifiers: Array<{ groupName: string; optionName: string; extraPrice: number }>;
  };

  let initialCartItems: InitialCartItem[] = [];

  if (isFnB && initialTableId) {
    const targetTable = tables.find((t) => t.id === initialTableId);
    if (targetTable?.activeOrderId) {
      // Cek apakah TableOrder sudah dibayar (transactionId != null)
      // Kalau sudah, skip auto-load — supaya kasir tidak charge 2x
      const tableOrderInfo = await prisma.tableOrder.findUnique({
        where: { id: targetTable.activeOrderId },
        select: { transactionId: true, tenantId: true },
      });

      const alreadyPaid = !!tableOrderInfo?.transactionId;
      // Validasi tenantId untuk defensive
      const validTenant = tableOrderInfo?.tenantId === session.user.tenantId;

      if (!alreadyPaid && validTenant) {
        const orderItems = await prisma.orderItem.findMany({
          where: {
            tableOrderId: targetTable.activeOrderId,
            tenantId: session.user.tenantId,
            // Hanya exclude CANCELLED — item SERVED tetap harus ditagih ke pelanggan
            status: { not: "CANCELLED" },
          },
          include: { modifiers: true },
          orderBy: { sentAt: "asc" },
        });

        initialCartItems = orderItems.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          productSku: item.productSku,
          variantSkuId: item.variantSkuId,
          variantLabel: item.variantLabel,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          modifiers: item.modifiers.map((m) => ({
            groupName: m.modifierGroupName,
            optionName: m.modifierOptionName,
            extraPrice: m.extraPrice,
          })),
        }));
      }
    }
  }

  return (
    <POSInterface
      products={products}
      categories={categories}
      tenant={tenant}
      cashierId={session.user.id}
      cashierName={session.user.name}
      cashierRole={session.user.role}
      tenantId={session.user.tenantId}
      outlet={outlet}
      businessType={businessType}
      tables={tables}
      initialTableId={initialTableId}
      initialCartItems={initialCartItems}
    />
  );
}
