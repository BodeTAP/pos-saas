"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { ClipboardList, Filter, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from "lucide-react";

interface AuditLogEntry {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  entityName: string | null;
  changes: Record<string, unknown> | null;
  userId: string;
  tenantId: string;
  createdAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

interface StaffItem {
  id: string;
  name: string;
  role: string;
}

interface AuditLogClientProps {
  logs: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
  staffList: StaffItem[];
  filters: {
    action: string | null;
    entity: string | null;
    userId: string | null;
    start: string | null;
    end: string | null;
  };
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  CREATE: { label: "Buat", color: "bg-green-100 text-green-700" },
  UPDATE: { label: "Ubah", color: "bg-blue-100 text-blue-700" },
  DELETE: { label: "Hapus", color: "bg-red-100 text-red-700" },
};

const ENTITY_LABELS: Record<string, string> = {
  Product: "Produk",
  Category: "Kategori",
  Staff: "Karyawan",
  Outlet: "Cabang",
  Settings: "Pengaturan",
  Customer: "Pelanggan",
  PurchaseOrder: "Pembelian (PO)",
};

const ENTITIES = Object.keys(ENTITY_LABELS);
const ACTIONS = ["CREATE", "UPDATE", "DELETE"];

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "boolean") return val ? "Aktif" : "Nonaktif";
  if (typeof val === "number") {
    // Heuristic: jika besar kemungkinan harga
    if (val > 1000) return formatCurrency(val);
    return String(val);
  }
  return String(val);
}

function ChangesDetail({ changes }: { changes: Record<string, unknown> | null }) {
  const [open, setOpen] = useState(false);
  if (!changes) return null;

  const before = (changes.before as Record<string, unknown>) || {};
  const after = (changes.after as Record<string, unknown>) || {};
  const keys = Object.keys(after);
  if (keys.length === 0) return null;

  const FIELD_LABELS: Record<string, string> = {
    name: "Nama", sellPrice: "Harga Jual", buyPrice: "Harga Beli",
    isActive: "Status", email: "Email", outletId: "Cabang",
    taxRate: "PPN", invoicePrefix: "Prefix Invoice",
    pointsPerAmount: "Poin per Belanja", pointValue: "Nilai Poin",
    address: "Alamat", phone: "Telepon",
  };

  return (
    <div className="mt-1">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
      >
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {keys.length} perubahan
      </button>
      {open && (
        <div className="mt-2 space-y-1">
          {keys.map((key) => (
            <div key={key} className="text-xs flex items-start gap-2">
              <span className="text-gray-500 min-w-[80px]">
                {FIELD_LABELS[key] || key}:
              </span>
              <span className="text-red-500 line-through">{formatValue(before[key])}</span>
              <span className="text-gray-400">→</span>
              <span className="text-green-600">{formatValue(after[key])}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AuditLogClient({
  logs,
  total,
  page,
  limit,
  staffList,
  filters,
}: AuditLogClientProps) {
  const router = useRouter();
  const totalPages = Math.ceil(total / limit);

  const [action, setAction] = useState(filters.action || "");
  const [entity, setEntity] = useState(filters.entity || "");
  const [userId, setUserId] = useState(filters.userId || "");
  const [start, setStart] = useState(filters.start || "");
  const [end, setEnd] = useState(filters.end || "");

  function buildUrl(overrides: Record<string, string | number>) {
    const p = new URLSearchParams();
    if (action) p.set("action", action);
    if (entity) p.set("entity", entity);
    if (userId) p.set("userId", userId);
    if (start) p.set("start", start);
    if (end) p.set("end", end);
    Object.entries(overrides).forEach(([k, v]) => {
      if (v) p.set(k, String(v));
      else p.delete(k);
    });
    return `/dashboard/audit-log?${p.toString()}`;
  }

  function applyFilter() {
    router.push(buildUrl({ page: 1 }));
  }

  function resetFilter() {
    setAction(""); setEntity(""); setUserId(""); setStart(""); setEnd("");
    router.push("/dashboard/audit-log");
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl lg:text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ClipboardList className="w-6 h-6 text-gray-600" />
          Log Aktivitas
        </h1>
        <p className="text-gray-500 mt-1 text-sm">
          Jejak semua perubahan data oleh pengguna toko.
        </p>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-semibold text-gray-700">Filter</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Semua Aksi</option>
            {ACTIONS.map((a) => (
              <option key={a} value={a}>{ACTION_LABELS[a].label}</option>
            ))}
          </select>

          <select
            value={entity}
            onChange={(e) => setEntity(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Semua Entitas</option>
            {ENTITIES.map((e) => (
              <option key={e} value={e}>{ENTITY_LABELS[e]}</option>
            ))}
          </select>

          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Semua Pengguna</option>
            {staffList.map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
            ))}
          </select>

          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Dari"
          />
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Sampai"
          />
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={applyFilter}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Terapkan
          </button>
          <button
            onClick={resetFilter}
            className="px-4 py-1.5 border border-gray-300 text-gray-600 hover:bg-gray-50 rounded-lg text-sm transition-colors"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700">
            {total.toLocaleString("id-ID")} entri
          </span>
          {totalPages > 1 && (
            <span className="text-xs text-gray-400">
              Halaman {page} dari {totalPages}
            </span>
          )}
        </div>

        {logs.length === 0 ? (
          <div className="py-16 text-center">
            <ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">Belum ada log aktivitas.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">Waktu</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Pengguna</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Aksi</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Entitas</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((log) => {
                  const actionInfo = ACTION_LABELS[log.action] || { label: log.action, color: "bg-gray-100 text-gray-700" };
                  return (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                        {new Date(log.createdAt).toLocaleString("id-ID", {
                          day: "2-digit", month: "short", year: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{log.user.name}</div>
                        <div className="text-xs text-gray-400">{log.user.role}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${actionInfo.color}`}>
                          {actionInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-gray-700">{ENTITY_LABELS[log.entity] || log.entity}</div>
                        {log.entityName && (
                          <div className="text-xs text-gray-400 truncate max-w-[160px]">{log.entityName}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {log.action === "UPDATE" && log.changes ? (
                          <ChangesDetail changes={log.changes} />
                        ) : log.action === "CREATE" ? (
                          <span className="text-xs text-gray-400">Data baru dibuat</span>
                        ) : log.action === "DELETE" ? (
                          <span className="text-xs text-red-400">Data dihapus/dinonaktifkan</span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
            <button
              onClick={() => router.push(buildUrl({ page: page - 1 }))}
              disabled={page <= 1}
              className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> Sebelumnya
            </button>
            <span className="text-sm text-gray-500">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => router.push(buildUrl({ page: page + 1 }))}
              disabled={page >= totalPages}
              className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >
              Berikutnya <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
