import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { POSInterface } from "@/components/pos/pos-interface";
import { NoTenant } from "@/components/ui/no-tenant";
import { getActiveOutletId } from "@/lib/active-outlet";
import Link from "next/link";
import { AlertCircle } from "lucide-react";

export default async function POSPage() {
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

  // Ambil produk dengan stok di outlet aktif
  const productsRaw = await prisma.product.findMany({
    where: { tenantId: session.user.tenantId, isActive: true },
    include: {
      category: true,
      outletStocks: { where: { outletId }, take: 1 },
    },
    orderBy: { name: "asc" },
  });

  // Filter hanya yang ada stok di outlet ini
  const products = productsRaw
    .map((p) => {
      const outletStock = p.outletStocks[0];
      return {
        ...p,
        stock: outletStock?.stock ?? 0,
        minStock: outletStock?.minStock ?? p.minStock,
        outletStocks: undefined,
      };
    })
    .filter((p) => p.stock > 0);

  const [categories, tenant, outlet] = await Promise.all([
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
      },
    }),
    prisma.outlet.findUnique({
      where: { id: outletId },
      select: { id: true, name: true, isMain: true },
    }),
  ]);

  return (
    <POSInterface
      products={products}
      categories={categories}
      tenant={tenant}
      cashierId={session.user.id}
      cashierName={session.user.name}
      tenantId={session.user.tenantId}
      outlet={outlet}
    />
  );
}
