"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";
import { TrendingUp, CreditCard, Filter, ChevronRight, ExternalLink } from "lucide-react";

interface InvoiceWithTenant {
  id: string;
  invoiceNumber: string;
  plan: string;
  amount: number;
  status: string;
  tripayPaymentUrl: string | null;
  createdAt: Date;
  tenantId: string;
  tenant: { name: string; slug: string };
}

interface BillingGlobalClientProps {
  invoices: InvoiceWithTenant[];
  totalCount: number;
  totalAmount: number;
  paidCount: number;
  paidAmount: number;
  filters: { status: string; start: string; end: string };
}

const statusColor: Record<string, string> = {
  PAID: "bg-green-100 text-green-700",
  PENDING: "bg-yellow-100 text-yellow-700",
  FAILED: "bg-red-100 text-red-700",
  EXPIRED: "bg-gray-100 text-gray-500",
};

export function BillingGlobalClient({
  invoices,
  totalCount,
  totalAmount,
  paidCount,
  paidAmount,
  filters,
}: BillingGlobalClientProps) {
  const router = useRouter();
  const [status, setStatus] = useState(filters.status);
  const [start, setStart] = useState(filters.start);
  const [end, setEnd] = useState(filters.end);

  function applyFilter() {
    const params = new URLSearchParams();
    if (status !== "ALL") params.set("status", status);
    params.set("start", start);
    params.set("end", end);
    router.push(`/super-admin/billing?${params.toString()}`);
  }

  function quickRange(days: number) {
    const e = new Date();
    const s = new Date();
    s.setDate(s.getDate() - days + 1);
    const startStr = s.toISOString().slice(0, 10);
    const endStr = e.toISOString().slice(0, 10);
    setStart(startStr);
    setEnd(endStr);
    const params = new URLSearchParams();
    if (status !== "ALL") params.set("status", status);
    params.set("start", startStr);
    params.set("end", endStr);
    router.push(`/super-admin/billing?${params.toString()}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Billing Global</h1>
        <p className="text-gray-500 mt-1">
          {new Date(filters.start).toLocaleDateString("id-ID", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          })}{" "}
          —{" "}
          {new Date(filters.end).toLocaleDateString("id-ID", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-green-600" />
            </div>
            <p className="text-xs text-gray-500">Pendapatan Lunas</p>
          </div>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(paidAmount)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
              <CreditCard className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-xs text-gray-500">Invoice Lunas</p>
          </div>
          <p className="text-xl font-bold text-gray-900">{paidCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Total Invoice</p>
          <p className="text-xl font-bold text-gray-900">{totalCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Total Nominal</p>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(totalAmount)}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-gray-600" />
          <h3 className="text-sm font-semibold text-gray-700">Filter</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
            >
              <option value="ALL">Semua</option>
              <option value="PAID">Lunas</option>
              <option value="PENDING">Menunggu</option>
              <option value="FAILED">Gagal</option>
              <option value="EXPIRED">Kedaluwarsa</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Dari</label>
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Sampai</label>
            <input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={applyFilter}
              className="w-full px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
            >
              Terapkan
            </button>
          </div>
        </div>
        <div className="flex gap-1.5 mt-2">
          <button onClick={() => quickRange(7)} className="px-3 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded">
            7 hari
          </button>
          <button onClick={() => quickRange(30)} className="px-3 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded">
            30 hari
          </button>
          <button onClick={() => quickRange(90)} className="px-3 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded">
            90 hari
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">No. Invoice</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Tenant</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Paket</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Nominal</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Tanggal</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-gray-400">
                    Tidak ada invoice di periode ini
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-blue-600">{inv.invoiceNumber}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/super-admin/tenants/${inv.tenantId}`}
                        className="text-gray-700 hover:text-blue-600 font-medium"
                      >
                        {inv.tenant.name}
                      </Link>
                      <p className="text-xs text-gray-400">{inv.tenant.slug}</p>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">{inv.plan}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      {formatCurrency(inv.amount)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          statusColor[inv.status] || "bg-gray-100"
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(inv.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        {inv.status === "PENDING" && inv.tripayPaymentUrl && (
                          <a
                            href={inv.tripayPaymentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:bg-blue-50 p-1 rounded"
                            title="Buka Tripay"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <Link
                          href={`/super-admin/tenants/${inv.tenantId}`}
                          className="text-gray-500 hover:text-gray-900 p-1 rounded"
                          title="Lihat tenant"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
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
