"use client";

import { useState } from "react";
import { toast } from "@/components/ui/toaster";
import { Plus, Edit, Trash2, Users, X, Loader2, UtensilsCrossed } from "lucide-react";
import { TableStatus } from "@prisma/client";

interface TableData {
  id: string;
  number: string;
  name: string | null;
  capacity: number;
  area: string | null;
  status: TableStatus;
  isActive: boolean;
  activeOrder: { id: string; openedAt: Date } | null;
}

interface TablesClientProps {
  initialTables: TableData[];
  currentOutletId: string | null;
}

const STATUS_CONFIG: Record<TableStatus, { label: string; color: string; bg: string }> = {
  EMPTY: { label: "Kosong", color: "text-green-700", bg: "bg-green-50 border-green-200" },
  OCCUPIED: { label: "Terisi", color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
  BILL: { label: "Minta Bill", color: "text-orange-700", bg: "bg-orange-50 border-orange-200" },
  RESERVED: { label: "Dipesan", color: "text-purple-700", bg: "bg-purple-50 border-purple-200" },
};

export function TablesClient({ initialTables, currentOutletId }: TablesClientProps) {
  const [tables, setTables] = useState<TableData[]>(initialTables);
  const [showModal, setShowModal] = useState(false);
  const [editTable, setEditTable] = useState<TableData | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // Group by area
  const areas = [...new Set(tables.map((t) => t.area || "Umum"))];

  function handleSaved(saved: TableData) {
    setTables((prev) => {
      const exists = prev.find((t) => t.id === saved.id);
      if (exists) return prev.map((t) => (t.id === saved.id ? saved : t));
      return [...prev, saved];
    });
    setShowModal(false);
    setEditTable(null);
  }

  async function handleDelete(table: TableData) {
    if (table.activeOrder) {
      toast.error("Meja masih memiliki order aktif.");
      return;
    }
    if (!confirm(`Hapus meja ${table.number}?`)) return;

    const original = tables.find((t) => t.id === table.id);
    // Optimistic delete
    setTables((prev) => prev.filter((t) => t.id !== table.id));
    setIsDeleting(table.id);

    try {
      const res = await fetch(`/api/tables/${table.id}`, { method: "DELETE" });
      if (!res.ok) {
        // Rollback
        if (original) setTables((prev) => [...prev, original]);
        const data = await res.json();
        toast.error(data.error || "Gagal menghapus meja.");
      } else {
        toast.success(`Meja ${table.number} berhasil dihapus.`);
      }
    } catch {
      if (original) setTables((prev) => [...prev, original]);
      toast.error("Terjadi kesalahan koneksi.");
    } finally {
      setIsDeleting(null);
    }
  }

  const totalEmpty = tables.filter((t) => t.status === "EMPTY").length;
  const totalOccupied = tables.filter((t) => t.status === "OCCUPIED" || t.status === "BILL").length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <UtensilsCrossed className="w-6 h-6 text-gray-600" />
            Manajemen Meja
          </h1>
          <p className="text-gray-500 mt-0.5 text-sm">
            {tables.length} meja · {totalEmpty} kosong · {totalOccupied} terisi
          </p>
        </div>
        <button
          onClick={() => { setEditTable(null); setShowModal(true); }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-medium transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Tambah Meja
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(Object.keys(STATUS_CONFIG) as TableStatus[]).map((status) => {
          const count = tables.filter((t) => t.status === status).length;
          const cfg = STATUS_CONFIG[status];
          return (
            <div key={status} className={`rounded-xl border p-4 ${cfg.bg}`}>
              <p className={`text-2xl font-bold ${cfg.color}`}>{count}</p>
              <p className="text-xs text-gray-500 mt-0.5">{cfg.label}</p>
            </div>
          );
        })}
      </div>

      {/* Tables grid by area */}
      {tables.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <UtensilsCrossed className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Belum ada meja</p>
          <p className="text-sm text-gray-400 mt-1">Tambahkan meja untuk mulai menggunakan fitur F&B</p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-4 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Tambah Meja Pertama
          </button>
        </div>
      ) : (
        areas.map((area) => {
          const areaTables = tables.filter((t) => (t.area || "Umum") === area);
          return (
            <div key={area}>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{area}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {areaTables.map((table) => {
                  const cfg = STATUS_CONFIG[table.status];
                  return (
                    <div
                      key={table.id}
                      className={`bg-white rounded-xl border-2 p-4 transition-all ${cfg.bg}`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="text-lg font-bold text-gray-900">#{table.number}</p>
                          {table.name && (
                            <p className="text-xs text-gray-500">{table.name}</p>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => { setEditTable(table); setShowModal(true); }}
                            className="p-1 text-gray-400 hover:text-blue-600 rounded"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(table)}
                            disabled={isDeleting === table.id || !!table.activeOrder}
                            className="p-1 text-gray-400 hover:text-red-500 rounded disabled:opacity-30"
                          >
                            {isDeleting === table.id
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <Trash2 className="w-3.5 h-3.5" />
                            }
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
                        <Users className="w-3 h-3" />
                        <span>{table.capacity} orang</span>
                      </div>

                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color} ${cfg.bg}`}>
                        {cfg.label}
                      </span>

                      {table.activeOrder && (
                        <p className="text-xs text-gray-400 mt-1">
                          Buka: {new Date(table.activeOrder.openedAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}

      {showModal && (
        <TableFormModal
          key={editTable?.id ?? "new"}
          table={editTable}
          outletId={currentOutletId}
          onClose={() => { setShowModal(false); setEditTable(null); }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

function TableFormModal({
  table,
  outletId,
  onClose,
  onSaved,
}: {
  table: TableData | null;
  outletId: string | null;
  onClose: () => void;
  onSaved: (t: TableData) => void;
}) {
  const [form, setForm] = useState({
    number: table?.number || "",
    name: table?.name || "",
    capacity: (table?.capacity || 4).toString(),
    area: table?.area || "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const url = table ? `/api/tables/${table.id}` : "/api/tables";
      const method = table ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          number: form.number.trim(),
          name: form.name.trim() || null,
          capacity: parseInt(form.capacity) || 4,
          area: form.area.trim() || null,
          // outletId tidak dikirim — API resolve dari session
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal menyimpan meja.");
        return;
      }
      toast.success(table ? "Meja berhasil diperbarui." : "Meja berhasil ditambahkan.");
      // Buat TableData yang proper — jangan spread {} karena bisa missing fields
      const savedTable: TableData = {
        id: data.table.id,
        number: data.table.number,
        name: data.table.name ?? null,
        capacity: data.table.capacity,
        area: data.table.area ?? null,
        status: data.table.status,
        isActive: data.table.isActive,
        activeOrder: table?.activeOrder ?? null,
      };
      onSaved(savedTable);
    } catch {
      setError("Terjadi kesalahan.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {table ? "Edit Meja" : "Tambah Meja"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nomor Meja <span className="text-red-500">*</span>
              </label>
              <input
                value={form.number}
                onChange={(e) => setForm((p) => ({ ...p, number: e.target.value }))}
                required
                placeholder="1, 2, VIP-1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kapasitas</label>
              <input
                type="number"
                min={1}
                max={50}
                value={form.capacity}
                onChange={(e) => setForm((p) => ({ ...p, capacity: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nama (opsional)</label>
            <input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Meja Pojok, Teras Depan"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Area (opsional)</label>
            <input
              value={form.area}
              onChange={(e) => setForm((p) => ({ ...p, area: e.target.value }))}
              placeholder="Indoor, Outdoor, VIP"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2.5 rounded-xl flex items-center justify-center gap-2"
            >
              {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...</> : "Simpan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
