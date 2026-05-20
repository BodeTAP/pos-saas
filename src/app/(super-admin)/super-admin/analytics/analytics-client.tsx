"use client";

import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { TrendingUp, ShoppingBag, Store, ChevronRight } from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface TrendPoint {
  date: string;
  label: string;
  revenue: number;
  newTenants: number;
}

interface AnalyticsClientProps {
  summary: { totalRevenue: number; totalTransactions: number };
  tenantsByPlan: { plan: string; count: number }[];
  tenantsByStatus: { status: string; count: number }[];
  topTenants: { id: string; name: string; plan: string; transactions: number }[];
  trendData: TrendPoint[];
}

const planLabel: Record<string, string> = {
  FREE: "Gratis",
  PRO: "Pro",
  ENTERPRISE: "Enterprise",
};

const PLAN_COLORS = ["#94a3b8", "#3b82f6", "#8b5cf6"];
const STATUS_COLORS = ["#10b981", "#3b82f6", "#ef4444", "#9ca3af"];

export function AnalyticsClient({
  summary,
  tenantsByPlan,
  tenantsByStatus,
  topTenants,
  trendData,
}: AnalyticsClientProps) {
  const planChartData = tenantsByPlan.map((t) => ({
    name: planLabel[t.plan] || t.plan,
    value: t.count,
  }));

  const statusChartData = tenantsByStatus.map((t) => ({
    name: t.status,
    value: t.count,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analitik Platform</h1>
        <p className="text-gray-500 mt-1">Performa keseluruhan platform — 90 hari terakhir</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-sm text-gray-500">Total Pendapatan Platform</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(summary.totalRevenue)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-sm text-gray-500">Total Transaksi Semua Tenant</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {summary.totalTransactions.toLocaleString("id-ID")}
          </p>
        </div>
      </div>

      {/* Revenue Trend */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Tren Pendapatan Platform</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(value) => {
                  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}jt`;
                  if (value >= 1000) return `${(value / 1000).toFixed(0)}rb`;
                  return value.toString();
                }}
              />
              <Tooltip
                formatter={(value) => [formatCurrency(Number(value) || 0), "Pendapatan"]}
                contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb" }}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 2, fill: "#10b981" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* New Tenants Trend */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Tenant Baru per Hari</h2>
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trendData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                formatter={(value) => [`${value} tenant`, "Baru"]}
                contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb" }}
              />
              <Bar dataKey="newTenants" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Distribusi Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Distribusi Paket</h2>
          {planChartData.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Belum ada data</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={planChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    fill="#8884d8"
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {planChartData.map((entry, i) => (
                      <Cell key={`cell-${i}`} fill={PLAN_COLORS[i % PLAN_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Status Langganan</h2>
          {statusChartData.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Belum ada data</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {statusChartData.map((entry, i) => (
                      <Cell key={`cell-${i}`} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Top Tenants */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Store className="w-5 h-5 text-gray-600" />
          <h2 className="font-semibold text-gray-900">Tenant Paling Aktif</h2>
        </div>
        {topTenants.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Belum ada data</p>
        ) : (
          <div className="space-y-2">
            {topTenants.map((tenant, index) => (
              <Link
                key={tenant.id}
                href={`/super-admin/tenants/${tenant.id}`}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <span className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-xs font-bold text-gray-600">
                  {index + 1}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{tenant.name}</p>
                  <p className="text-xs text-gray-500">{planLabel[tenant.plan] || tenant.plan}</p>
                </div>
                <p className="text-sm font-semibold text-gray-900">
                  {tenant.transactions} transaksi
                </p>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
