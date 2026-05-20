"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Store,
  Save,
  Loader2,
  Users,
  Package,
  ShoppingBag,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

interface UserSummary {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: Date | string;
}

interface OutletSummary {
  id: string;
  name: string;
  isMain: boolean;
  isActive: boolean;
  createdAt: Date | string;
}

interface InvoiceSummary {
  id: string;
  invoiceNumber: string;
  plan: string;
  amount: number;
  status: string;
  createdAt: Date | string;
}

interface TenantDetail {
  id: string;
  name: string;
  email: string;
  slug: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  plan: string;
  subscriptionStatus: string;
  subscriptionEndsAt: Date | null;
  trialEndsAt: Date | null;
  maxProducts: number;
  maxCashiers: number;
  maxOutlets: number;
  createdAt: Date | string;
  _count: {
    users: number;
    products: number;
    transactions: number;
    customers: number;
    outlets: number;
  };
  users: UserSummary[];
  outlets: OutletSummary[];
  billingInvoices: InvoiceSummary[];
}

interface TenantDetailClientProps {
  tenant: TenantDetail;
  totalRevenue: number;
}

const statusColor: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  TRIAL: "bg-blue-100 text-blue-700",
  EXPIRED: "bg-red-100 text-red-700",
  SUSPENDED: "bg-gray-100 text-gray-500",
  PAID: "bg-green-100 text-green-700",
  PENDING: "bg-yellow-100 text-yellow-700",
  FAILED: "bg-red-100 text-red-700",
};

export function TenantDetailClient({
  tenant,
  totalRevenue,
}: TenantDetailClientProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    plan: tenant.plan,
    subscriptionStatus: tenant.subscriptionStatus,
    subscriptionEndsAt: tenant.subscriptionEndsAt
      ? new Date(tenant.subscriptionEndsAt).toISOString().slice(0, 10)
      : "",
    maxProducts: tenant.maxProducts.toString(),
    maxCashiers: tenant.maxCashiers.toString(),
    maxOutlets: tenant.maxOutlets.toString(),
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSave() {
    setIsSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/super-admin/tenants/${tenant.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: form.plan,
          subscriptionStatus: form.subscriptionStatus,
          subscriptionEndsAt: form.subscriptionEndsAt || null,
          maxProducts: parseInt(form.maxProducts) || 0,
          maxCashiers: parseInt(form.maxCashiers) || 0,
          maxOutlets: parseInt(form.maxOutlets) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal menyimpan perubahan.");
        return;
      }
      setSuccess("Perubahan berhasil disimpan.");
      router.refresh();
    } catch {
      setError("Terjadi kesalahan koneksi.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleQuickAction(
    action: "ACTIVATE" | "SUSPEND" | "EXTEND_30",
    confirmMessage: string
  ) {
    if (!confirm(confirmMessage)) return;

    setIsSaving(true);
    setError("");
    setSuccess("");

    try {
      let payload: Record<string, unknown> = {};
      if (action === "ACTIVATE") {
        payload = { subscriptionStatus: "ACTIVE" };
      } else if (action === "SUSPEND") {
        payload = { subscriptionStatus: "SUSPENDED" };
      } else if (action === "EXTEND_30") {
        const newEnd = new Date(
          tenant.subscriptionEndsAt
            ? new Date(tenant.subscriptionEndsAt).getTime()
            : Date.now()
        );
        if (newEnd < new Date()) newEnd.setTime(Date.now());
        newEnd.setDate(newEnd.getDate() + 30);
        payload = {
          subscriptionStatus: "ACTIVE",
          subscriptionEndsAt: newEnd.toISOString(),
        };
      }

      const res = await fetch(`/api/super-admin/tenants/${tenant.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal menjalankan aksi.");
        return;
      }
      setSuccess("Aksi berhasil dijalankan.");
      router.refresh();
    } catch {
      setError("Terjadi kesalahan koneksi.");
    } finally {
      setIsSaving(false);
    }
  }

  const stats = [
    { label: "Pendapatan Toko", value: formatCurrency(totalRevenue), icon: TrendingUp, color: "text-green-600", bg: "bg-green-50" },
    { label: "Pengguna", value: tenant._count.users.toString(), icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Produk", value: tenant._count.products.toString(), icon: Package, color: "text-purple-600", bg: "bg-purple-50" },
    { label: "Transaksi", value: tenant._count.transactions.toString(), icon: ShoppingBag, color: "text-orange-600", bg: "bg-orange-50" },
  ];

  return (
    <div className="space-y-6">
      <Link
        href="/super-admin/tenants"
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="w-4 h-4" />
        Kembali ke daftar tenant
      </Link>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Store className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{tenant.name}</h1>
              <p className="text-sm text-gray-500">{tenant.email}</p>
              <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                <span>{tenant.slug}</span>
                {tenant.city && <span>· {tenant.city}</span>}
                <span>· Daftar {formatDate(tenant.createdAt)}</span>
              </div>
            </div>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              statusColor[tenant.subscriptionStatus] || "bg-gray-100"
            }`}
          >
            {tenant.subscriptionStatus}
          </span>
        </div>

        {/* Quick Actions */}
        <div className="mt-4 flex flex-wrap gap-2">
          {tenant.subscriptionStatus === "SUSPENDED" && (
            <button
              onClick={() =>
                handleQuickAction(
                  "ACTIVATE",
                  "Aktifkan kembali tenant ini? Tenant akan bisa login lagi."
                )
              }
              disabled={isSaving}
              className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm"
            >
              Aktifkan Kembali
            </button>
          )}
          {tenant.subscriptionStatus !== "SUSPENDED" && (
            <button
              onClick={() =>
                handleQuickAction(
                  "SUSPEND",
                  "Suspend tenant ini? Tenant akan langsung tidak bisa akses sistem."
                )
              }
              disabled={isSaving}
              className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-sm border border-red-200"
            >
              Suspend
            </button>
          )}
          <button
            onClick={() =>
              handleQuickAction(
                "EXTEND_30",
                "Perpanjang langganan 30 hari? Status akan diubah ke ACTIVE."
              )
            }
            disabled={isSaving}
            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-sm border border-blue-200"
          >
            Perpanjang 30 Hari
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className={`w-9 h-9 ${s.bg} rounded-lg flex items-center justify-center mb-2`}>
                <Icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <p className="text-lg font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          );
        })}
      </div>

      {/* Edit Plan & Limits */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Atur Paket & Batasan</h2>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm mb-4">
            {success}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Paket</label>
            <select
              name="plan"
              value={form.plan}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="FREE">Gratis</option>
              <option value="PRO">Pro</option>
              <option value="ENTERPRISE">Enterprise</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              name="subscriptionStatus"
              value={form.subscriptionStatus}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="TRIAL">Trial</option>
              <option value="ACTIVE">Active</option>
              <option value="EXPIRED">Expired</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tanggal Berakhir Langganan
            </label>
            <input
              type="date"
              name="subscriptionEndsAt"
              value={form.subscriptionEndsAt}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            {tenant.trialEndsAt && form.subscriptionStatus === "TRIAL" && (
              <p className="text-xs text-gray-500 mt-1">
                Trial berakhir: {formatDate(tenant.trialEndsAt)}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Batas Produk</label>
            <input
              type="number"
              name="maxProducts"
              min={0}
              value={form.maxProducts}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Batas Kasir</label>
            <input
              type="number"
              name="maxCashiers"
              min={0}
              value={form.maxCashiers}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Batas Cabang</label>
            <input
              type="number"
              name="maxOutlets"
              min={1}
              value={form.maxOutlets}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="mt-4 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Simpan Perubahan
        </button>
      </div>

      {/* Users */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Pengguna ({tenant.users.length})</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-2 font-medium text-gray-600">Nama</th>
              <th className="text-left px-4 py-2 font-medium text-gray-600">Email</th>
              <th className="text-left px-4 py-2 font-medium text-gray-600">Peran</th>
              <th className="text-center px-4 py-2 font-medium text-gray-600">Status</th>
              <th className="text-left px-4 py-2 font-medium text-gray-600">Bergabung</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {tenant.users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-2 font-medium text-gray-900">{u.name}</td>
                <td className="px-4 py-2 text-gray-500">{u.email}</td>
                <td className="px-4 py-2 text-gray-600">{u.role}</td>
                <td className="px-4 py-2 text-center">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      u.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {u.isActive ? "Aktif" : "Nonaktif"}
                  </span>
                </td>
                <td className="px-4 py-2 text-gray-500">{formatDate(u.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Outlets */}
      {tenant.outlets.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Cabang ({tenant.outlets.length})</h2>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {tenant.outlets.map((o) => (
              <div
                key={o.id}
                className="border border-gray-200 rounded-lg p-3 flex items-center justify-between"
              >
                <div>
                  <p className="font-medium text-gray-900 text-sm">{o.name}</p>
                  <p className="text-xs text-gray-500">{formatDate(o.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {o.isMain && (
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                      Utama
                    </span>
                  )}
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      o.isActive
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {o.isActive ? "Aktif" : "Nonaktif"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invoices */}
      {tenant.billingInvoices.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">
              Riwayat Invoice ({tenant.billingInvoices.length})
            </h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-2 font-medium text-gray-600">No. Invoice</th>
                <th className="text-center px-4 py-2 font-medium text-gray-600">Paket</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600">Nominal</th>
                <th className="text-center px-4 py-2 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Tanggal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tenant.billingInvoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="px-4 py-2 font-medium text-blue-600">{inv.invoiceNumber}</td>
                  <td className="px-4 py-2 text-center text-gray-600">{inv.plan}</td>
                  <td className="px-4 py-2 text-right font-semibold text-gray-900">
                    {formatCurrency(inv.amount)}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        statusColor[inv.status] || "bg-gray-100"
                      }`}
                    >
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-500">{formatDate(inv.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
