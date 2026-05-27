"use client";

import { useState, useEffect, useCallback } from "react";
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
  Users,
  DollarSign,
  TrendingDown,
  Percent,
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

interface GrossProfitProduct {
  productId: string;
  productName: string;
  quantity: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  marginPct: number;
}

interface CashierStat {
  cashierId: string;
  cashierName: string;
  totalRevenue: number;
  totalTransactions: number;
  avgTransaction: number;
}

interface ReportsClientProps {
  summary: {
    totalRevenue: number;
    totalTransactions: number;
    avgTransaction: number;
    totalCogs: number;
    totalGrossProfit: number;
    totalMarginPct: number;
  };
  dailyData: DailyDataPoint[];
  topProducts: TopProduct[];
  cashierData: CashierStat[];
  grossProfitData: GrossProfitProduct[];
  startDate: string;
  endDate: string;
  isFnB?: boolean;
}

type ActiveTab = "penjualan" | "laba" | "fnb";

export function ReportsClient({
  summary,
  dailyData,
  topProducts,
  cashierData,
  grossProfitData,
  startDate,
  endDate,
  isFnB = false,
}: ReportsClientProps) {
  const router = useRouter();
  const [isExporting, setIsExporting] = useState<"excel" | "csv" | null>(null);
  const [start, setStart] = useState(startDate);
  const [end, setEnd] = useState(endDate);
  const [activeTab, setActiveTab] = useState<ActiveTab>("penjualan");

  // F&B report state
  const [fnbData, setFnbData] = useState<{
    summary: { totalRevenue: number; totalTransactions: number; avgTransaction: number; avgDurationMinutes: number };
    revenueByArea: Array<{ area: string; revenue: number; transactions: number; avgDurationMinutes: number }>;
    topItems: Array<{ productName: string; quantity: number; revenue: number }>;
    dailyData: DailyDataPoint[];
  } | null>(null);
  const [fnbLoading, setFnbLoading] = useState(false);

  const loadFnbData = useCallback(async () => {
    setFnbLoading(true);
    try {
      const res = await fetch(`/api/reports/fnb?start=${start}&end=${end}`);
      if (!res.ok) return;
      const data = await res.json();
      setFnbData(data);
    } catch {
      toast.error("Gagal memuat laporan F&B.");
    } finally {
      setFnbLoading(false);
    }
  }, [start, end]);

  useEffect(() => {
    if (activeTab === "fnb" && !fnbData) {
      loadFnbData();
    }
  }, [activeTab, fnbData, loadFnbData]);

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

  // hasCogs: true hanya jika ada transaksi dengan buyPrice > 0
  // Jika semua buyPrice = 0, berarti data harga beli belum diisi (transaksi lama)
  const hasCogs = summary.totalCogs > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Laporan Penjualan</h1>
          <p className="text-gray-500 mt-1 text-sm">
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
        <div className="flex gap-2 flex-shrink-0">
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
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-auto"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Sampai</label>
            <input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-auto"
            />
          </div>
          <button
            onClick={applyFilter}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Terapkan
          </button>
          <div className="flex gap-1.5 sm:ml-auto">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => quickRange(d)}
                className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {d} hari
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Cards — 6 kartu: 3 penjualan + 3 laba */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-green-600" />
            </div>
            <p className="text-xs text-gray-500">Pendapatan</p>
          </div>
          <p className="text-lg font-bold text-gray-900 truncate">
            {formatCurrency(summary.totalRevenue)}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
              <ShoppingBag className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-xs text-gray-500">Transaksi</p>
          </div>
          <p className="text-lg font-bold text-gray-900">{summary.totalTransactions}</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-purple-600" />
            </div>
            <p className="text-xs text-gray-500">Rata-rata</p>
          </div>
          <p className="text-lg font-bold text-gray-900 truncate">
            {formatCurrency(summary.avgTransaction)}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center">
              <TrendingDown className="w-4 h-4 text-red-500" />
            </div>
            <p className="text-xs text-gray-500">HPP</p>
          </div>
          <p className="text-lg font-bold text-gray-900 truncate">
            {hasCogs
              ? formatCurrency(summary.totalCogs)
              : <span className="text-sm text-gray-400 font-normal">Belum ada data</span>
            }
          </p>
        </div>

        <div className={`bg-white rounded-xl border p-4 ${
          hasCogs && summary.totalGrossProfit < 0 ? "border-red-200 bg-red-50" : "border-gray-200"
        }`}>
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              hasCogs && summary.totalGrossProfit < 0 ? "bg-red-100" : "bg-emerald-50"
            }`}>
              <DollarSign className={`w-4 h-4 ${
                hasCogs && summary.totalGrossProfit < 0 ? "text-red-600" : "text-emerald-600"
              }`} />
            </div>
            <p className="text-xs text-gray-500">Laba Kotor</p>
          </div>
          <p className={`text-lg font-bold truncate ${
            !hasCogs ? "text-gray-400" :
            summary.totalGrossProfit >= 0 ? "text-emerald-700" : "text-red-600"
          }`}>
            {hasCogs
              ? formatCurrency(summary.totalGrossProfit)
              : <span className="text-sm font-normal">Belum ada data</span>
            }
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
              <Percent className="w-4 h-4 text-amber-600" />
            </div>
            <p className="text-xs text-gray-500">Margin</p>
          </div>
          <p className={`text-lg font-bold ${
            !hasCogs ? "text-gray-400" :
            summary.totalMarginPct >= 20 ? "text-emerald-700" :
            summary.totalMarginPct >= 10 ? "text-amber-600" :
            summary.totalMarginPct > 0 ? "text-orange-600" : "text-red-600"
          }`}>
            {hasCogs
              ? `${summary.totalMarginPct.toFixed(1)}%`
              : <span className="text-sm font-normal">—</span>
            }
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab("penjualan")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "penjualan"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Penjualan
        </button>
        <button
          onClick={() => setActiveTab("laba")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "laba"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Laba Kotor
        </button>
        {isFnB && (
          <button
            onClick={() => setActiveTab("fnb")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "fnb"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            🍽️ F&B
          </button>
        )}
      </div>

      {/* TAB: PENJUALAN */}
      {activeTab === "penjualan" && (
        <>
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
              <p className="text-sm text-gray-400 text-center py-8">Belum ada data penjualan</p>
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
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
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
              <div className="overflow-x-auto">
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
            </div>
          )}

          {/* Laporan per Kasir */}
          {cashierData.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                <Users className="w-5 h-5 text-gray-600" />
                <h2 className="font-semibold text-gray-900">Performa per Kasir</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-4 py-3 font-medium text-gray-600">#</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Kasir</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-600">Transaksi</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Rata-rata</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Total Pendapatan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {cashierData.map((c, i) => (
                      <tr key={c.cashierId} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-500">{i + 1}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{c.cashierName}</td>
                        <td className="px-4 py-3 text-center text-gray-700">{c.totalTransactions}</td>
                        <td className="px-4 py-3 text-right text-gray-700">
                          {formatCurrency(c.avgTransaction)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">
                          {formatCurrency(c.totalRevenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* TAB: LABA KOTOR */}
      {activeTab === "laba" && (
        <>
          {!hasCogs ? (
            <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
              <div className="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <DollarSign className="w-7 h-7 text-amber-500" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Data Harga Beli Belum Tersedia</h3>
              <p className="text-sm text-gray-500 max-w-sm mx-auto">
                Laporan laba kotor membutuhkan data harga beli produk. Pastikan field{" "}
                <strong>Harga Beli</strong> sudah diisi di halaman Produk, lalu lakukan transaksi baru.
                Transaksi lama tidak memiliki snapshot harga beli.
              </p>
            </div>
          ) : (
            <>
              {/* Info banner */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800 flex items-start gap-2">
                <span className="mt-0.5">ℹ️</span>
                <span>
                  Laba kotor = Pendapatan − HPP (Harga Pokok Penjualan). HPP dihitung dari harga beli
                  produk saat transaksi terjadi. Diskon transaksi tidak dikurangi dari HPP.
                  {grossProfitData.some((p) => p.cogs === 0) && (
                    <> Produk dengan HPP <strong>—</strong> belum memiliki harga beli — isi di halaman Produk.</>
                  )}
                </span>
              </div>

              {/* Gross Profit per Product Table */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h2 className="font-semibold text-gray-900">Laba Kotor per Produk</h2>
                  <span className="text-xs text-gray-400">Top 20 produk berdasarkan pendapatan</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left px-4 py-3 font-medium text-gray-600">#</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">Produk</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600">Terjual</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600">Pendapatan</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600">HPP</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600">Laba Kotor</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600">Margin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {grossProfitData.map((p, i) => (
                        <tr key={p.productId} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-500">{i + 1}</td>
                          <td className="px-4 py-3 font-medium text-gray-900">{p.productName}</td>
                          <td className="px-4 py-3 text-right text-gray-700">{p.quantity}</td>
                          <td className="px-4 py-3 text-right text-gray-900">
                            {formatCurrency(p.revenue)}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-600">
                            {p.cogs > 0 ? formatCurrency(p.cogs) : (
                              <span className="text-gray-400 text-xs">—</span>
                            )}
                          </td>
                          <td className={`px-4 py-3 text-right font-semibold ${
                            p.grossProfit >= 0 ? "text-emerald-700" : "text-red-600"
                          }`}>
                            {p.cogs > 0 ? formatCurrency(p.grossProfit) : (
                              <span className="text-gray-400 text-xs font-normal">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {p.cogs > 0 ? (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                p.marginPct >= 30 ? "bg-emerald-100 text-emerald-700" :
                                p.marginPct >= 15 ? "bg-amber-100 text-amber-700" :
                                p.marginPct >= 0 ? "bg-orange-100 text-orange-700" :
                                "bg-red-100 text-red-700"
                              }`}>
                                {p.marginPct.toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-gray-400 text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {/* Footer total */}
                    <tfoot>
                      <tr className="bg-gray-50 border-t-2 border-gray-200 font-semibold">
                        <td colSpan={3} className="px-4 py-3 text-gray-700">Total</td>
                        <td className="px-4 py-3 text-right text-gray-900">
                          {formatCurrency(summary.totalRevenue)}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">
                          {formatCurrency(summary.totalCogs)}
                        </td>
                        <td className={`px-4 py-3 text-right ${
                          summary.totalGrossProfit >= 0 ? "text-emerald-700" : "text-red-600"
                        }`}>
                          {formatCurrency(summary.totalGrossProfit)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            summary.totalMarginPct >= 30 ? "bg-emerald-100 text-emerald-700" :
                            summary.totalMarginPct >= 15 ? "bg-amber-100 text-amber-700" :
                            summary.totalMarginPct >= 0 ? "bg-orange-100 text-orange-700" :
                            "bg-red-100 text-red-700"
                          }`}>
                            {summary.totalMarginPct.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}
      {/* TAB: F&B */}
      {activeTab === "fnb" && (
        <>
          {fnbLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : !fnbData ? (
            <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
              <p className="text-gray-500">Gagal memuat data F&B.</p>
              <button
                onClick={loadFnbData}
                className="mt-3 text-sm text-blue-600 hover:underline"
              >
                Coba lagi
              </button>
            </div>
          ) : (
            <>
              {/* F&B Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <p className="text-xs text-gray-500 mb-1">Pendapatan F&B</p>
                  <p className="text-lg font-bold text-gray-900 truncate">
                    {formatCurrency(fnbData.summary.totalRevenue)}
                  </p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <p className="text-xs text-gray-500 mb-1">Transaksi Meja</p>
                  <p className="text-lg font-bold text-gray-900">{fnbData.summary.totalTransactions}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <p className="text-xs text-gray-500 mb-1">Rata-rata / Meja</p>
                  <p className="text-lg font-bold text-gray-900 truncate">
                    {formatCurrency(fnbData.summary.avgTransaction)}
                  </p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <p className="text-xs text-gray-500 mb-1">Rata-rata Durasi</p>
                  <p className="text-lg font-bold text-gray-900">
                    {fnbData.summary.avgDurationMinutes > 0
                      ? `${fnbData.summary.avgDurationMinutes} mnt`
                      : "—"}
                  </p>
                </div>
              </div>

              {/* Revenue per Area */}
              {fnbData.revenueByArea.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100">
                    <h2 className="font-semibold text-gray-900">Revenue per Area</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="text-left px-4 py-3 font-medium text-gray-600">Area</th>
                          <th className="text-right px-4 py-3 font-medium text-gray-600">Transaksi</th>
                          <th className="text-right px-4 py-3 font-medium text-gray-600">Pendapatan</th>
                          <th className="text-right px-4 py-3 font-medium text-gray-600">Rata-rata Durasi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {fnbData.revenueByArea.map((area) => (
                          <tr key={area.area} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-900">{area.area}</td>
                            <td className="px-4 py-3 text-right text-gray-700">{area.transactions}</td>
                            <td className="px-4 py-3 text-right font-semibold text-gray-900">
                              {formatCurrency(area.revenue)}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-600">
                              {area.avgDurationMinutes > 0 ? `${area.avgDurationMinutes} mnt` : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Top Menu Items */}
              {fnbData.topItems.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100">
                    <h2 className="font-semibold text-gray-900">Menu Terlaris</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="text-left px-4 py-3 font-medium text-gray-600">#</th>
                          <th className="text-left px-4 py-3 font-medium text-gray-600">Menu</th>
                          <th className="text-right px-4 py-3 font-medium text-gray-600">Terjual</th>
                          <th className="text-right px-4 py-3 font-medium text-gray-600">Pendapatan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {fnbData.topItems.map((item, i) => (
                          <tr key={item.productName} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-gray-500">{i + 1}</td>
                            <td className="px-4 py-3 font-medium text-gray-900">{item.productName}</td>
                            <td className="px-4 py-3 text-right text-gray-700">{item.quantity}</td>
                            <td className="px-4 py-3 text-right font-semibold text-gray-900">
                              {formatCurrency(item.revenue)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {fnbData.summary.totalTransactions === 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
                  <p className="text-gray-500">Belum ada transaksi F&B di periode ini.</p>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
