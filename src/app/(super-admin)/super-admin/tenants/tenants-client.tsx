"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { Search, Store, ChevronRight, Filter } from "lucide-react";

interface TenantData {
  id: string;
  name: string;
  email: string;
  slug: string;
  city: string | null;
  plan: string;
  subscriptionStatus: string;
  subscriptionEndsAt: Date | null;
  trialEndsAt: Date | null;
  createdAt: Date;
  _count: { users: number; products: number; transactions: number };
}

interface TenantsClientProps {
  initialTenants: TenantData[];
  initialFilters: { search: string; status: string; plan: string };
}

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

export function TenantsClient({ initialTenants, initialFilters }: TenantsClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState(initialFilters.search);
  const [status, setStatus] = useState(initialFilters.status);
  const [plan, setPlan] = useState(initialFilters.plan);

  function applyFilter() {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status !== "ALL") params.set("status", status);
    if (plan !== "ALL") params.set("plan", plan);
    router.push(`/super-admin/tenants?${params.toString()}`);
  }

  function resetFilter() {
    setSearch("");
    setStatus("ALL");
    setPlan("ALL");
    router.push("/super-admin/tenants");
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Manajemen Tenant</h1>
        <p className="text-gray-500 mt-1">{initialTenants.length} tenant ditemukan</p>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-gray-600" />
          <h3 className="text-sm font-semibold text-gray-700">Filter</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama, email, slug..."
              onKeyDown={(e) => e.key === "Enter" && applyFilter()}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">Semua Status</option>
            <option value="TRIAL">Trial</option>
            <option value="ACTIVE">Aktif</option>
            <option value="EXPIRED">Kedaluwarsa</option>
            <option value="SUSPENDED">Suspend</option>
          </select>
          <select
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">Semua Paket</option>
            <option value="FREE">Gratis</option>
            <option value="PRO">Pro</option>
            <option value="ENTERPRISE">Enterprise</option>
          </select>
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={applyFilter}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
          >
            Terapkan
          </button>
          <button
            onClick={resetFilter}
            className="px-4 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg text-sm"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Tenant Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
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
                <th className="text-center px-4 py-3 font-medium text-gray-600">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {initialTenants.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-gray-400">
                    <Store className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p>Tidak ada tenant yang cocok</p>
                  </td>
                </tr>
              ) : (
                initialTenants.map((tenant) => (
                  <tr key={tenant.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{tenant.name}</p>
                      <p className="text-xs text-gray-400">{tenant.slug}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{tenant.email}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                        {planLabel[tenant.plan]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          statusColor[tenant.subscriptionStatus] || "bg-gray-100"
                        }`}
                      >
                        {tenant.subscriptionStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-700">
                      {tenant._count.users}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-700">
                      {tenant._count.products}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-700">
                      {tenant._count.transactions}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {formatDate(tenant.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Link
                        href={`/super-admin/tenants/${tenant.id}`}
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        Detail
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
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
