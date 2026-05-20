import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import {
  ShoppingBag,
  TrendingUp,
  Package,
  AlertTriangle,
  ArrowUpRight,
  Users,
  Store,
} from "lucide-react";
import Link from "next/link";

// Dashboard untuk tenant biasa (Owner)
async function getTenantDashboardData(tenantId: string, outletId: string | null) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const txWhere = {
    tenantId,
    status: "COMPLETED" as const,
    ...(outletId && { outletId }),
  };

  const [todayTransactions, totalProducts, lowStockOutletData, recentTransactions] =
    await Promise.all([
      prisma.transaction.aggregate({
        where: { ...txWhere, createdAt: { gte: today, lt: tomorrow } },
        _sum: { total: true },
        _count: true,
      }),
      prisma.product.count({
        where: { tenantId, isActive: true },
      }),
      // Low stock dari outlet aktif
      outletId
        ? prisma.outletStock.findMany({
            where: {
              tenantId,
              outletId,
              product: { isActive: true },
            },
            include: {
              product: { select: { name: true, unit: true } },
            },
            orderBy: { stock: "asc" },
            take: 50,
          })
        : Promise.resolve([]),
      prisma.transaction.findMany({
        where: txWhere,
        take: 5,
        orderBy: { createdAt: "desc" },
        include: { cashier: { select: { name: true } } },
      }),
    ]);

  const lowStockProducts = lowStockOutletData
    .filter((s) => s.stock <= s.minStock)
    .slice(0, 5)
    .map((s) => ({
      id: s.productId,
      name: s.product.name,
      stock: s.stock,
      minStock: s.minStock,
      unit: s.product.unit,
    }));

  return {
    todayRevenue: todayTransactions._sum.total || 0,
    todayCount: todayTransactions._count,
    totalProducts,
    lowStockProducts,
    recentTransactions,
  };
}

// Dashboard untuk Super Admin — overview semua tenant
async function getSuperAdminDashboardData() {
  const [totalTenants, totalUsers, recentTenants] = await Promise.all([
    prisma.tenant.count(),
    prisma.user.count(),
    prisma.tenant.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        plan: true,
        subscriptionStatus: true,
        createdAt: true,
        _count: { select: { users: true, products: true } },
      },
    }),
  ]);

  return { totalTenants, totalUsers, recentTenants };
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session) return null;

  // Super Admin: tampilkan overview platform
  if (session.user.role === "SUPER_ADMIN") {
    const data = await getSuperAdminDashboardData();

    const planLabel: Record<string, string> = {
      FREE: "Gratis",
      PRO: "Pro",
      ENTERPRISE: "Enterprise",
    };
    const statusColor: Record<string, string> = {
      ACTIVE: "bg-green-100 text-green-700",
      TRIAL: "bg-blue-100 text-blue-700",
      EXPIRED: "bg-red-100 text-red-700",
      SUSPENDED: "bg-gray-100 text-gray-500",
    };

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Platform Overview</h1>
          <p className="text-gray-500 mt-1">Ringkasan seluruh tenant di platform</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl p-5 border border-gray-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                <Store className="w-5 h-5 text-blue-600" />
              </div>
              <p className="text-sm text-gray-500">Total Tenant</p>
            </div>
            <p className="text-3xl font-bold text-gray-900">{data.totalTenants}</p>
          </div>
          <div className="bg-white rounded-xl p-5 border border-gray-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
              <p className="text-sm text-gray-500">Total Pengguna</p>
            </div>
            <p className="text-3xl font-bold text-gray-900">{data.totalUsers}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Tenant Terbaru</h2>
          {data.recentTenants.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Belum ada tenant</p>
          ) : (
            <div className="space-y-3">
              {data.recentTenants.map((tenant) => (
                <div
                  key={tenant.id}
                  className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{tenant.name}</p>
                    <p className="text-xs text-gray-500">
                      {tenant._count.users} user · {tenant._count.products} produk
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{planLabel[tenant.plan]}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[tenant.subscriptionStatus] || "bg-gray-100 text-gray-500"}`}>
                      {tenant.subscriptionStatus}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Owner / Kasir: tampilkan dashboard toko
  if (!session.user.tenantId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400">Akun ini belum terhubung ke toko manapun.</p>
      </div>
    );
  }

  const data = await getTenantDashboardData(session.user.tenantId, session.user.outletId);

  const stats = [
    {
      label: "Pendapatan Hari Ini",
      value: formatCurrency(data.todayRevenue),
      icon: TrendingUp,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "Transaksi Hari Ini",
      value: data.todayCount.toString(),
      icon: ShoppingBag,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Total Produk",
      value: data.totalProducts.toString(),
      icon: Package,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      label: "Stok Menipis",
      value: data.lowStockProducts.length.toString(),
      icon: AlertTriangle,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Ringkasan operasional toko hari ini</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-white rounded-xl p-5 border border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 ${stat.bg} rounded-lg flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${stat.color}`} />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Transaksi Terbaru */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Transaksi Terbaru</h2>
            <Link
              href="/dashboard/transactions"
              className="text-sm text-blue-600 hover:underline flex items-center gap-1"
            >
              Lihat semua <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          {data.recentTransactions.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              Belum ada transaksi hari ini
            </p>
          ) : (
            <div className="space-y-3">
              {data.recentTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{tx.invoiceNumber}</p>
                    <p className="text-xs text-gray-500">{tx.cashier.name}</p>
                  </div>
                  <p className="text-sm font-semibold text-gray-900">
                    {formatCurrency(tx.total)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Low Stock Alert */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Peringatan Stok Rendah</h2>
            <Link
              href="/dashboard/products"
              className="text-sm text-blue-600 hover:underline flex items-center gap-1"
            >
              Kelola <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          {data.lowStockProducts.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              Semua stok dalam kondisi aman ✓
            </p>
          ) : (
            <div className="space-y-3">
              {data.lowStockProducts.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{product.name}</p>
                    <p className="text-xs text-gray-500">
                      Min: {product.minStock} {product.unit}
                    </p>
                  </div>
                  <span
                    className={`text-sm font-semibold px-2 py-0.5 rounded-full ${
                      product.stock === 0
                        ? "bg-red-100 text-red-700"
                        : "bg-orange-100 text-orange-700"
                    }`}
                  >
                    {product.stock} {product.unit}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
