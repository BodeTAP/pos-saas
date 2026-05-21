"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toaster";
import { formatCurrency } from "@/lib/utils";
import {
  BarChart3,
  TrendingUp,
  ShoppingBag,
  Package,
  Download,
  Loader2,
  Calendar,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface DailyDataPoint {
  date: string;
  label: string;
  revenue: number;
  count: number;
}

interface TopProduct {
  name: string;
  quantity: number;
  revenue: number;
}

interface ReportsClientProps {
  summary: {
    totalRevenue: number;
    totalTransactions: number;
    avgTransaction: number;
  };
  dailyData: DailyDataPoint[];
  topProducts: TopProduct[];
  startDate: string;
  endDate: string;
}

export function ReportsClient({
  summary,
  dailyData,
  topProducts,
  startDate,
  endDate,
}: ReportsClientProps) {
  const router = useRouter();
  const [isExporting, setIsExporting] = useState<"excel" | "csv" | null>(null);
  const [start, setStart] = useState(startDate);
  const [end, setEnd] = useState(endDate);

  function applyFilter() {
    if (new Date(start) > new Date(end)) {
      toast.error("Tanggal mulai tidak boleh setelah tanggal akhir.");
      return;
    }
    router.push(`/dashboard/reports?start=${start}&end=${end}`);
  }

  function quickRange(days: number) {
    const e = new Date();
    const s = new Date();
    s.setDate(s.getDate() - (days - 1));
    const startStr = s.toISOString().slice(0, 10);
    const endStr = e.toISOString().slice(0, 10);
    setStart(startStr);
    setEnd(endStr);
    router.push(`/dashboard/reports?start=${startStr}&end=${endStr}`);
  }

  async function handleExport(format: "excel" | "csv") {
    setIsExporting(format);
    try {
      const res = await fetch(
        `/api/reports/export?format=${format}&start=${start}&end=${end}`
      );
      if (!res.ok) throw new Error("Export gagal");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `laporan-${start}-sampai-${end}.${format === "excel" ? "xlsx" : "csv"}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      toast.error("Gagal mengunduh laporan. Silakan coba lagi.");
    } finally {
      setIsExporting(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Laporan Penjualan</h1>
          <p className="text-gray-500 mt-1">
            {new Date(startDate).toLocaleDateString("id-ID", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}{" "}
            —{" "}
            {new Date(endDate).toLocaleDateString("id-ID", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleExport("excel")}
            disabled={isExporting !== null}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
          >
            {isExporting === "excel" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Excel
          </button>
          <button
            onClick={() => handleExport("csv")}
            disabled={isExporting !== null}
            className="flex items-center gap-2 bg-gray-700 hover:bg-gray-800 disabled:bg-gray-300 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
          >
            {isExporting === "csv" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            CSV
          </button>
        </div>
      </div>

      {/* Filter Tanggal */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-4 h-4 text-gray-600" />
          <h3 className="text-sm font-semibold text-gray-700">Filter Periode</h3>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Dari</label>
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Sampai</label>
            <input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={applyFilter}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Terapkan
          </button>
          <div className="flex gap-1.5 ml-auto">
            <button
              onClick={() => quickRange(7)}
              className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              7 hari
            </button>
            <button
              onClick={() => quickRange(30)}
              className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              30 hari
            </button>
            <button
              onClick={() => quickRange(90)}
              className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              90 hari
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-sm text-gray-500">Total Pendapatan</p>
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
            <p className="text-sm text-gray-500">Total Transaksi</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{summary.totalTransactions}</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-purple-600" />
            </div>
            <p className="text-sm text-gray-500">Rata-rata Transaksi</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(summary.avgTransaction)}
          </p>
        </div>
      </div>

      {/* Daily Revenue Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-gray-600" />
          <h2 className="font-semibold text-gray-900">Tren Pendapatan Harian</h2>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dailyData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
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
                labelStyle={{ color: "#111", fontWeight: 600 }}
                contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb" }}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#2563eb"
                strokeWidth={2}
                dot={{ r: 3, fill: "#2563eb" }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Products Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Package className="w-5 h-5 text-gray-600" />
          <h2 className="font-semibold text-gray-900">10 Produk Terlaris</h2>
        </div>
        {topProducts.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">
            Belum ada data penjualan
          </p>
        ) : (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={topProducts}
                layout="vertical"
                margin={{ top: 5, right: 20, left: 90, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  width={90}
                />
                <Tooltip
                  formatter={(value, name) => {
                    const num = Number(value) || 0;
                    if (name === "quantity") return [`${num} pcs`, "Terjual"];
                    return [formatCurrency(num), "Pendapatan"];
                  }}
                  contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb" }}
                />
                <Bar dataKey="quantity" fill="#2563eb" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Top Products Table */}
      {topProducts.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Detail Produk Terlaris</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">#</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Produk</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Terjual</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Pendapatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {topProducts.map((p, i) => (
                <tr key={p.name} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500">{i + 1}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{p.quantity}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">
                    {formatCurrency(p.revenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
