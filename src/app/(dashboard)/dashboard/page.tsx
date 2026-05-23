import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import {
  ShoppingBag, TrendingUp, Package, AlertTriangle, ArrowUpRight,
  Users, Store, Clock, ShoppingCart, Timer, Banknote, BarChart3,
} from "lucide-react";
import Link from "next/link";
import { TodayDate } from "@/components/ui/today-date";

// ─────────────────────────────────────────────
// DATA FETCHERS
// ─────────────────────────────────────────────

async function getOwnerDashboardData(tenantId: string, outletId: string | null) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const txWhere = {
    tenantId,
    status: "COMPLETED" as const,
    ...(outletId && { outletId }),
  };

  const [todayTx, totalProducts, lowStockData, recentTx] = await Promise.all([
    prisma.transaction.aggregate({
      where: { ...txWhere, createdAt: { gte: today, lt: tomorrow } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.product.count({ where: { tenantId, isActive: true } }),
    outletId
      ? prisma.outletStock.findMany({
          where: { tenantId, outletId, product: { isActive: true } },
          include: { product: { select: { name: true, unit: true } } },
          orderBy: { stock: "asc" },
          take: 50,
        })
      : Promise.resolve([]),
    // Transaksi terbaru hari ini (bukan sepanjang waktu)
    prisma.transaction.findMany({
      where: { ...txWhere, createdAt: { gte: today, lt: tomorrow } },
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { cashier: { select: { name: true } } },
    }),
  ]);

  return {
    todayRevenue: todayTx._sum.total || 0,
    todayCount: todayTx._count,
    totalProducts,
    lowStockProducts: lowStockData
      .filter((s) => s.stock <= s.minStock)
      .slice(0, 5)
      .map((s) => ({ id: s.productId, name: s.product.name, stock: s.stock, minStock: s.minStock, unit: s.product.unit })),
    recentTransactions: recentTx,
  };
}
async function getCashierDashboardData(cashierId: string, tenantId: string, outletId: string | null) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const txWhere = {
    cashierId, tenantId,
    status: "COMPLETED" as const,
    createdAt: { gte: today, lt: tomorrow },
    ...(outletId && { outletId }),
  };

  const [todayStats, recentTx, activeShift, totalItemsAgg] = await Promise.all([
    prisma.transaction.aggregate({
      where: txWhere,
      _sum: { total: true },
      _count: true,
      _avg: { total: true },
    }),
    prisma.transaction.findMany({
      where: txWhere,
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true, invoiceNumber: true, total: true, paymentMethod: true, createdAt: true,
        items: { select: { quantity: true } },
      },
    }),
    prisma.cashierShift.findFirst({
      where: { cashierId, tenantId, status: "OPEN", ...(outletId && { outletId }) },
      orderBy: { openedAt: "desc" },
    }),
    prisma.transactionItem.aggregate({
      where: { transaction: txWhere },
      _sum: { quantity: true },
    }),
  ]);

  return {
    todayRevenue: todayStats._sum.total || 0,
    todayCount: todayStats._count,
    avgTransaction: todayStats._avg.total || 0,
    totalItems: totalItemsAgg._sum.quantity || 0,
    recentTransactions: recentTx,
    activeShift,
  };
}

async function getSuperAdminData() {
  const [totalTenants, totalUsers, recentTenants] = await Promise.all([
    prisma.tenant.count(),
    prisma.user.count(),
    prisma.tenant.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true, name: true, plan: true, subscriptionStatus: true, createdAt: true,
        _count: { select: { users: true, products: true } },
      },
    }),
  ]);
  return { totalTenants, totalUsers, recentTenants };
}

// ─────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────

export default async function DashboardPage() {
  const session = await auth();
  if (!session) return null;

  // ── Super Admin ──
  if (session.user.role === "SUPER_ADMIN") {
    const data = await getSuperAdminData();
    const planLabel: Record<string, string> = { FREE: "Gratis", PRO: "Pro", ENTERPRISE: "Enterprise" };
    const statusColor: Record<string, string> = {
      ACTIVE: "bg-green-100 text-green-700", TRIAL: "bg-blue-100 text-blue-700",
      EXPIRED: "bg-red-100 text-red-700", SUSPENDED: "bg-gray-100 text-gray-500",
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
              {data.recentTenants.map((t) => (
                <div key={t.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{t.name}</p>
                    <p className="text-xs text-gray-500">{t._count.users} user · {t._count.products} produk</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{planLabel[t.plan]}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[t.subscriptionStatus] || "bg-gray-100 text-gray-500"}`}>
                      {t.subscriptionStatus}
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

  if (!session.user.tenantId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400">Akun ini belum terhubung ke toko manapun.</p>
      </div>
    );
  }

  // ── Kasir Dashboard ──
  if (session.user.role === "KASIR") {
    const data = await getCashierDashboardData(session.user.id, session.user.tenantId, session.user.outletId);
    const paymentLabel: Record<string, string> = {
      CASH: "Tunai", QRIS: "QRIS", TRANSFER: "Transfer", CARD: "Kartu", OTHER: "Lainnya",
    };
    const shiftDuration = data.activeShift
      ? (() => {
          const diffMs = Date.now() - new Date(data.activeShift.openedAt).getTime();
          const h = Math.floor(diffMs / 3600000);
          const m = Math.floor((diffMs % 3600000) / 60000);
          if (diffMs < 60000) return "Baru dibuka";
          return h > 0 ? `${h}j ${m}m` : `${m} menit`;
        })()
      : null;

    return (
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-gray-900">
              Selamat datang, {session.user.name?.split(" ")[0] || "Kasir"} 👋
            </h1>
            <p className="text-gray-500 mt-0.5 text-sm">
              <TodayDate />
            </p>
          </div>
          <Link
            href="/dashboard/pos"
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors w-fit"
          >
            <ShoppingCart className="w-4 h-4" />
            Buka Kasir
          </Link>
        </div>

        {/* Status Shift */}
        <div className={`rounded-xl border p-4 flex items-center justify-between gap-4 ${
          data.activeShift ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              data.activeShift ? "bg-green-100" : "bg-gray-200"
            }`}>
              <Timer className={`w-5 h-5 ${data.activeShift ? "text-green-600" : "text-gray-400"}`} />
            </div>
            <div>
              <p className={`text-sm font-semibold ${data.activeShift ? "text-green-800" : "text-gray-600"}`}>
                {data.activeShift ? "Shift Sedang Berjalan" : "Tidak Ada Shift Aktif"}
              </p>
              {data.activeShift ? (
                <p className="text-xs text-green-600">
                  Dibuka pukul {new Date(data.activeShift.openedAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                  {" · "}Durasi: {shiftDuration}
                  {data.activeShift.openingCash > 0 && ` · Kas awal: ${formatCurrency(data.activeShift.openingCash)}`}
                </p>
              ) : (
                <p className="text-xs text-gray-400">Buka shift dari halaman Kasir untuk mulai bekerja</p>
              )}
            </div>
          </div>
          <Link
            href="/dashboard/pos"
            className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors flex-shrink-0 ${
              data.activeShift
                ? "bg-green-600 hover:bg-green-700 text-white"
                : "bg-gray-200 hover:bg-gray-300 text-gray-700"
            }`}
          >
            {data.activeShift ? "Lihat Kasir" : "Buka Shift"}
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Transaksi", value: data.todayCount.toString(), icon: ShoppingBag, color: "text-blue-600", bg: "bg-blue-50", sub: "hari ini" },
            { label: "Pendapatan", value: formatCurrency(data.todayRevenue), icon: TrendingUp, color: "text-green-600", bg: "bg-green-50", sub: "hari ini" },
            { label: "Item Terjual", value: data.totalItems.toString(), icon: Package, color: "text-purple-600", bg: "bg-purple-50", sub: "hari ini" },
            { label: "Rata-rata", value: formatCurrency(data.avgTransaction), icon: BarChart3, color: "text-amber-600", bg: "bg-amber-50", sub: "per transaksi" },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-8 h-8 ${s.bg} rounded-lg flex items-center justify-center`}>
                    <Icon className={`w-4 h-4 ${s.color}`} />
                  </div>
                  <p className="text-xs text-gray-500">{s.label}</p>
                </div>
                <p className="text-xl font-bold text-gray-900 truncate">{s.value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
              </div>
            );
          })}
        </div>

        {/* Transaksi Terbaru */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-500" />
              <h2 className="font-semibold text-gray-900">Transaksi Terbaru Hari Ini</h2>
            </div>
            <Link href="/dashboard/pos/history" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
              Lihat semua <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          {data.recentTransactions.length === 0 ? (
            <div className="py-12 text-center">
              <ShoppingBag className="w-10 h-10 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Belum ada transaksi hari ini</p>
              <Link href="/dashboard/pos" className="mt-3 inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
                <ShoppingCart className="w-3.5 h-3.5" />
                Mulai transaksi
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {data.recentTransactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{tx.invoiceNumber}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(tx.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                      {" · "}{tx.items.reduce((s, i) => s + i.quantity, 0)} item
                      {" · "}<span className="text-gray-500">{paymentLabel[tx.paymentMethod] ?? tx.paymentMethod}</span>
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-gray-900">{formatCurrency(tx.total)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/dashboard/pos" className="flex items-center gap-3 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-xl transition-colors">
            <ShoppingCart className="w-5 h-5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold">Kasir (POS)</p>
              <p className="text-xs text-blue-200">Proses transaksi</p>
            </div>
          </Link>
          <Link href="/dashboard/pos/history" className="flex items-center gap-3 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 p-4 rounded-xl transition-colors">
            <Banknote className="w-5 h-5 flex-shrink-0 text-gray-500" />
            <div>
              <p className="text-sm font-semibold">Riwayat Shift</p>
              <p className="text-xs text-gray-400">Lihat transaksi hari ini</p>
            </div>
          </Link>
        </div>
      </div>
    );
  }

  // ── Owner Dashboard ──
  const data = await getOwnerDashboardData(session.user.tenantId, session.user.outletId);
  const stats = [
    { label: "Pendapatan Hari Ini", value: formatCurrency(data.todayRevenue), icon: TrendingUp, color: "text-green-600", bg: "bg-green-50" },
    { label: "Transaksi Hari Ini", value: data.todayCount.toString(), icon: ShoppingBag, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Total Produk", value: data.totalProducts.toString(), icon: Package, color: "text-purple-600", bg: "bg-purple-50" },
    { label: "Stok Menipis", value: data.lowStockProducts.length.toString(), icon: AlertTriangle, color: "text-orange-600", bg: "bg-orange-50" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Ringkasan operasional toko hari ini</p>
      </div>
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
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Transaksi Terbaru</h2>
            <Link href="/dashboard/transactions" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
              Lihat semua <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          {data.recentTransactions.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Belum ada transaksi hari ini</p>
          ) : (
            <div className="space-y-3">
              {data.recentTransactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{tx.invoiceNumber}</p>
                    <p className="text-xs text-gray-500">{tx.cashier.name}</p>
                  </div>
                  <p className="text-sm font-semibold text-gray-900">{formatCurrency(tx.total)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Peringatan Stok Rendah</h2>
            <Link href="/dashboard/inventory" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
              Kelola <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          {data.lowStockProducts.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Semua stok dalam kondisi aman ✓</p>
          ) : (
            <div className="space-y-3">
              {data.lowStockProducts.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{p.name}</p>
                    <p className="text-xs text-gray-500">Min: {p.minStock} {p.unit}</p>
                  </div>
                  <span className={`text-sm font-semibold px-2 py-0.5 rounded-full ${
                    p.stock === 0 ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"
                  }`}>
                    {p.stock} {p.unit}
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
