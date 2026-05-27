"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toaster";
import {
  CalendarClock, Plus, Phone, Users, Clock, X, Loader2,
  CheckCircle, AlertCircle, Trash2, Edit,
} from "lucide-react";

type ReservationStatus = "CONFIRMED" | "SEATED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";

interface TableInfo {
  id: string;
  number: string;
  name: string | null;
  area: string | null;
  capacity: number;
}

interface Reservation {
  id: string;
  guestName: string;
  guestPhone: string | null;
  guestCount: number;
  reservedAt: string;
  durationMin: number;
  note: string | null;
  status: ReservationStatus;
  table: TableInfo;
}

interface Props {
  initialReservations: Reservation[];
  tables: TableInfo[];
}

const STATUS_CONFIG: Record<ReservationStatus, { label: string; color: string; bg: string }> = {
  CONFIRMED: { label: "Terjadwal", color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
  SEATED: { label: "Sudah Duduk", color: "text-green-700", bg: "bg-green-50 border-green-200" },
  COMPLETED: { label: "Selesai", color: "text-gray-700", bg: "bg-gray-100 border-gray-200" },
  CANCELLED: { label: "Dibatalkan", color: "text-red-700", bg: "bg-red-50 border-red-200" },
  NO_SHOW: { label: "Tidak Datang", color: "text-orange-700", bg: "bg-orange-50 border-orange-200" },
};

function formatDateTime(d: Date): string {
  return d.toLocaleString("id-ID", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function isToday(d: Date): boolean {
  const now = new Date();
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
}

function dayKey(d: Date): string {
  return d.toLocaleDateString("id-ID", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
}

export function ReservationsClient({ initialReservations, tables }: Props) {
  const router = useRouter();
  const [reservations, setReservations] = useState<Reservation[]>(initialReservations);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Reservation | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Group by day
  const grouped = useMemo(() => {
    const groups: Record<string, Reservation[]> = {};
    for (const r of reservations) {
      const key = dayKey(new Date(r.reservedAt));
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    }
    return groups;
  }, [reservations]);

  const counts = useMemo(() => ({
    today: reservations.filter((r) => isToday(new Date(r.reservedAt)) && r.status === "CONFIRMED").length,
    seated: reservations.filter((r) => r.status === "SEATED").length,
    upcoming: reservations.filter((r) => r.status === "CONFIRMED").length,
  }), [reservations]);

  async function handleStatusChange(r: Reservation, newStatus: ReservationStatus) {
    setUpdatingId(r.id);
    try {
      const res = await fetch(`/api/reservations/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Gagal update status.");
        return;
      }
      setReservations((prev) => prev.map((x) => (x.id === r.id ? { ...x, status: newStatus } : x)));
      toast.success("Status reservasi diperbarui.");
      router.refresh();
    } catch {
      toast.error("Terjadi kesalahan.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleDelete(r: Reservation) {
    if (!confirm(`Hapus reservasi a/n ${r.guestName}?`)) return;
    setUpdatingId(r.id);
    try {
      const res = await fetch(`/api/reservations/${r.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Gagal menghapus reservasi.");
        return;
      }
      setReservations((prev) => prev.filter((x) => x.id !== r.id));
      toast.success("Reservasi dihapus.");
      router.refresh();
    } catch {
      toast.error("Terjadi kesalahan.");
    } finally {
      setUpdatingId(null);
    }
  }

  function handleSaved(saved: Reservation) {
    setReservations((prev) => {
      const exists = prev.find((r) => r.id === saved.id);
      if (exists) return prev.map((r) => (r.id === saved.id ? saved : r));
      return [...prev, saved].sort((a, b) =>
        new Date(a.reservedAt).getTime() - new Date(b.reservedAt).getTime()
      );
    });
    setShowForm(false);
    setEditing(null);
    router.refresh();
  }

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarClock className="w-6 h-6 text-gray-600" />
            Reservasi Meja
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">7 hari ke depan</p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-medium self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Reservasi Baru
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-2xl font-bold text-blue-700">{counts.today}</p>
          <p className="text-xs text-gray-600 mt-0.5">Hari ini terjadwal</p>
        </div>
        <div className="rounded-xl border border-green-200 bg-green-50 p-4">
          <p className="text-2xl font-bold text-green-700">{counts.seated}</p>
          <p className="text-xs text-gray-600 mt-0.5">Sudah duduk</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-2xl font-bold text-gray-700">{counts.upcoming}</p>
          <p className="text-xs text-gray-600 mt-0.5">Total upcoming</p>
        </div>
      </div>

      {/* List */}
      {reservations.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <CalendarClock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Belum ada reservasi</p>
          <p className="text-sm text-gray-400 mt-1">Buat reservasi baru dengan tombol di atas</p>
        </div>
      ) : (
        Object.entries(grouped).map(([day, list]) => (
          <div key={day}>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{day}</h2>
            <div className="space-y-2">
              {list.map((r) => {
                const cfg = STATUS_CONFIG[r.status];
                const reservedDate = new Date(r.reservedAt);
                const isUpdating = updatingId === r.id;
                const canModify = r.status === "CONFIRMED" || r.status === "SEATED";
                return (
                  <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-4">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-900">{r.guestName}</p>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.color} ${cfg.bg}`}>
                            {cfg.label}
                          </span>
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {formatDateTime(reservedDate)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" />
                            {r.guestCount} orang
                          </span>
                          <span className="text-gray-700 font-medium">
                            Meja #{r.table.number}
                            {r.table.area && <span className="text-gray-400"> ({r.table.area})</span>}
                          </span>
                          {r.guestPhone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3.5 h-3.5" />
                              {r.guestPhone}
                            </span>
                          )}
                          <span className="text-gray-400">{r.durationMin} mnt</span>
                        </div>
                        {r.note && (
                          <div className="mt-2 bg-yellow-50 border border-yellow-200 rounded-lg px-2.5 py-1.5">
                            <p className="text-xs text-yellow-800 italic">📝 {r.note}</p>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {/* Status quick actions */}
                        {r.status === "CONFIRMED" && (
                          <>
                            <button
                              onClick={() => handleStatusChange(r, "SEATED")}
                              disabled={isUpdating}
                              className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50"
                              title="Tamu sudah datang"
                            >
                              {isUpdating ? <Loader2 className="w-3 h-3 animate-spin" /> : "Tamu Datang"}
                            </button>
                            <button
                              onClick={() => handleStatusChange(r, "NO_SHOW")}
                              disabled={isUpdating}
                              className="px-2 py-1.5 border border-orange-300 text-orange-600 hover:bg-orange-50 text-xs font-medium rounded-lg disabled:opacity-50"
                              title="Tamu tidak datang"
                            >
                              No-show
                            </button>
                          </>
                        )}
                        {r.status === "SEATED" && (
                          <button
                            onClick={() => handleStatusChange(r, "COMPLETED")}
                            disabled={isUpdating}
                            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-800 text-white text-xs font-semibold rounded-lg disabled:opacity-50"
                          >
                            {isUpdating ? <Loader2 className="w-3 h-3 animate-spin" /> : "Selesai"}
                          </button>
                        )}
                        {canModify && (
                          <button
                            onClick={() => { setEditing(r); setShowForm(true); }}
                            className="p-1.5 text-gray-400 hover:text-blue-600 rounded"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(r)}
                          disabled={isUpdating}
                          className="p-1.5 text-gray-400 hover:text-red-500 rounded disabled:opacity-30"
                          title="Hapus"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      {showForm && (
        <ReservationFormModal
          tables={tables}
          editing={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

function ReservationFormModal({
  tables,
  editing,
  onClose,
  onSaved,
}: {
  tables: TableInfo[];
  editing: Reservation | null;
  onClose: () => void;
  onSaved: (r: Reservation) => void;
}) {
  // Default: 1 jam ke depan, dibulatkan ke 30 mnt
  const defaultDateTime = useMemo(() => {
    if (editing) {
      const d = new Date(editing.reservedAt);
      // Format YYYY-MM-DDTHH:MM untuk datetime-local
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    const d = new Date(Date.now() + 60 * 60 * 1000);
    d.setMinutes(d.getMinutes() < 30 ? 30 : 0, 0, 0);
    if (d.getMinutes() === 0) d.setHours(d.getHours() + 1);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }, [editing]);

  const [form, setForm] = useState({
    guestName: editing?.guestName ?? "",
    guestPhone: editing?.guestPhone ?? "",
    guestCount: editing?.guestCount ?? 2,
    tableId: editing?.table.id ?? tables[0]?.id ?? "",
    reservedAt: defaultDateTime,
    durationMin: editing?.durationMin ?? 120,
    note: editing?.note ?? "",
  });
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const selectedTable = tables.find((t) => t.id === form.tableId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setError("");
    try {
      const url = editing ? `/api/reservations/${editing.id}` : "/api/reservations";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableId: form.tableId,
          guestName: form.guestName.trim(),
          guestPhone: form.guestPhone.trim() || null,
          guestCount: form.guestCount,
          reservedAt: new Date(form.reservedAt).toISOString(),
          durationMin: form.durationMin,
          note: form.note.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal menyimpan reservasi.");
        return;
      }
      toast.success(editing ? "Reservasi diperbarui." : "Reservasi berhasil dibuat.");
      onSaved(data.reservation);
    } catch {
      setError("Terjadi kesalahan koneksi.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-gray-900">
            {editing ? "Edit Reservasi" : "Reservasi Baru"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nama Tamu <span className="text-red-500">*</span>
            </label>
            <input
              required
              value={form.guestName}
              onChange={(e) => setForm((p) => ({ ...p, guestName: e.target.value }))}
              placeholder="Budi Santoso"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">No. HP</label>
              <input
                value={form.guestPhone}
                onChange={(e) => setForm((p) => ({ ...p, guestPhone: e.target.value }))}
                placeholder="08xxx"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Jumlah Orang <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min={1}
                max={50}
                required
                value={form.guestCount}
                onChange={(e) => setForm((p) => ({ ...p, guestCount: Math.max(1, parseInt(e.target.value) || 1) }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pilih Meja <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={form.tableId}
              onChange={(e) => setForm((p) => ({ ...p, tableId: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            >
              {tables.map((t) => (
                <option key={t.id} value={t.id}>
                  Meja #{t.number}
                  {t.name && ` — ${t.name}`}
                  {t.area && ` (${t.area})`}
                  {` · ${t.capacity} orang`}
                </option>
              ))}
            </select>
            {selectedTable && form.guestCount > selectedTable.capacity && (
              <p className="mt-1 text-xs text-amber-600">
                ⚠ Jumlah orang ({form.guestCount}) melebihi kapasitas meja ({selectedTable.capacity}).
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tanggal & Jam <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                required
                value={form.reservedAt}
                onChange={(e) => setForm((p) => ({ ...p, reservedAt: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Durasi (menit)</label>
              <select
                value={form.durationMin}
                onChange={(e) => setForm((p) => ({ ...p, durationMin: parseInt(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
              >
                <option value={60}>1 jam</option>
                <option value={90}>1.5 jam</option>
                <option value={120}>2 jam</option>
                <option value={180}>3 jam</option>
                <option value={240}>4 jam</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Catatan</label>
            <textarea
              rows={2}
              value={form.note}
              onChange={(e) => setForm((p) => ({ ...p, note: e.target.value.slice(0, 300) }))}
              placeholder="Ulang tahun, alergi seafood, dll"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
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
              disabled={isSaving}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2.5 rounded-xl flex items-center justify-center gap-2"
            >
              {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...</> : (
                <><CheckCircle className="w-4 h-4" /> Simpan</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
