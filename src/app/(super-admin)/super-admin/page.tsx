import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Store, Users, TrendingUp, CreditCard } from "lucide-react";

export default async function SuperAdminOverviewPage() {
  const [totalTenants, totalUsers, activeTenants, recentTenants, revenueData] =
    await Promise.all([
      prisma.tenant.count(),
      prisma.user.count({ where: { role: { not: "SUPER_ADMIN" } } }),
      prisma.tenant.count({ where: { subscriptionStatus: "ACTIVE" } }),
      prisma.tenant.findMany({
        take: 8,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          email: true,
          plan: true,
          subscriptionStatus: true,
          createdAt: true,
          _count: { select: { users: true, products: true, transactions: true } },
        },
      }),
      prisma.billingInvoice.aggregate({
        where: { status: "PAID" },
        _sum: { amount: true },
      }),
    ]);

  const planLabel: Record<string, string> = { FREE: "Gratis", PRO: "Pro", ENTERPRISE: "Enterprise" };
  const statusColor: Record<string, string> = {
    ACTIVE: "bg-green-100 text-green-700",
    TRIAL: "bg-blue-100 text-blue-700",
    EXPIRED: "bg-red-100 text-red-700",
    SUSPENDED: "bg-gray-100 text-gray-500",
  };

  const stats = [
    { label: "Total Tenant", value: totalTenants.toString(), icon: Store, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Tenant Aktif", value: activeTenants.toString(), icon: TrendingUp, color: "text-green-600", bg: "bg-green-50" },
    { label: "Total Pengguna", value: totalUsers.toString(), icon: Users, color: "text-purple-600", bg: "bg-purple-50" },
    { label: "Total Pendapatan", value: formatCurrency(revenueData._sum.amount || 0), icon: CreditCard, color: "text-orange-600", bg: "bg-orange-50" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Platform Overview</h1>
        <p className="text-gray-500 mt-1">Ringkasan seluruh operasional platform POS SaaS</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-white rounded-xl p-5 border border-gray-200">
              <div className={`w-10 h-10 ${stat.bg} rounded-lg flex items-center justify-center mb-3`}>
                <Icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* Tenant List */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Tenant Terbaru</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Nama Toko</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Paket</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">User</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Produk</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Transaksi</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Daftar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentTenants.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-gray-400">
                    Belum ada tenant terdaftar
                  </td>
                </tr>
              ) : (
                recentTenants.map((tenant) => (
                  <tr key={tenant.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{tenant.name}</td>
                    <td className="px-4 py-3 text-gray-500">{tenant.email}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                        {planLabel[tenant.plan] || tenant.plan}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor[tenant.subscriptionStatus] || "bg-gray-100 text-gray-500"}`}>
                        {tenant.subscriptionStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-700">{tenant._count.users}</td>
                    <td className="px-4 py-3 text-center text-gray-700">{tenant._count.products}</td>
                    <td className="px-4 py-3 text-center text-gray-700">{tenant._count.transactions}</td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(tenant.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
