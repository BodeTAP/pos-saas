"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "@/components/ui/toaster";
import { RefreshCw, Clock, UtensilsCrossed, CheckCircle, AlertCircle } from "lucide-react";

interface ActiveOrder {
  id: string;
  openedAt: string;
  note: string | null;
  durationMinutes: number;
}

interface KitchenTable {
  id: string;
  number: string;
  name: string | null;
  area: string | null;
  capacity: number;
  status: "OCCUPIED" | "BILL";
  outletName: string;
  activeOrder: ActiveOrder | null;
}

interface KitchenDisplayClientProps {
  initialTables: KitchenTable[];
}

const STATUS_CONFIG = {
  OCCUPIED: { label: "Terisi", color: "text-blue-700", bg: "bg-blue-50 border-blue-200", dot: "bg-blue-500" },
  BILL: { label: "Minta Bill", color: "text-orange-700", bg: "bg-orange-50 border-orange-200", dot: "bg-orange-500" },
};

function getDurationColor(minutes: number): string {
  if (minutes < 30) return "text-green-600";
  if (minutes < 60) return "text-yellow-600";
  return "text-red-600";
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} mnt`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}j ${m}m`;
}

export function KitchenDisplayClient({ initialTables }: KitchenDisplayClientProps) {
  const [tables, setTables] = useState<KitchenTable[]>(initialTables);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  const fetchTables = useCallback(async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      const res = await fetch("/api/kitchen");
      if (!res.ok) return;
      const data = await res.json();
      setTables(data.tables);
      setLastUpdated(new Date());
    } catch {
      if (!silent) toast.error("Gagal memuat data.");
    } finally {
      if (!silent) setIsRefreshing(false);
    }
  }, []);

  // Auto-refresh setiap 10 detik
  useEffect(() => {
    const interval = setInterval(() => fetchTables(true), 10000);
    return () => clearInterval(interval);
  }, [fetchTables]);

  // Update durasi setiap menit
  useEffect(() => {
    const interval = setInterval(() => {
      setTables((prev) =>
        prev.map((t) => ({
          ...t,
          activeOrder: t.activeOrder
            ? {
                ...t.activeOrder,
                durationMinutes: Math.floor(
                  (Date.now() - new Date(t.activeOrder.openedAt).getTime()) / 60000
                ),
              }
            : null,
        }))
      );
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  async function handleRequestBill(tableId: string) {
    setUpdatingStatus(tableId);
    try {
      const res = await fetch(`/api/tables/${tableId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "BILL" }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Gagal update status.");
        return;
      }
      setTables((prev) =>
        prev.map((t) => (t.id === tableId ? { ...t, status: "BILL" } : t))
      );
      toast.success("Status meja diubah ke Minta Bill.");
    } catch {
      toast.error("Terjadi kesalahan.");
    } finally {
      setUpdatingStatus(null);
    }
  }

  const areas = [...new Set(tables.map((t) => t.area || "Umum"))];
  const billCount = tables.filter((t) => t.status === "BILL").length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <UtensilsCrossed className="w-6 h-6 text-gray-600" />
            Kitchen Display
          </h1>
          <p className="text-gray-500 mt-0.5 text-sm">
            {tables.length} meja aktif
            {billCount > 0 && (
              <span className="ml-2 text-orange-600 font-medium">· {billCount} minta bill</span>
            )}
            · Update otomatis setiap 10 detik
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">
            Update: {lastUpdated.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
          <button
            onClick={() => fetchTables(false)}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Alert: meja minta bill */}
      {billCount > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0" />
          <p className="text-sm text-orange-800 font-medium">
            {billCount} meja sedang menunggu pembayaran
          </p>
        </div>
      )}

      {/* Empty state */}
      {tables.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Semua meja kosong</p>
          <p className="text-sm text-gray-400 mt-1">Tidak ada order aktif saat ini</p>
        </div>
      ) : (
        areas.map((area) => {
          const areaTables = tables.filter((t) => (t.area || "Umum") === area);
          return (
            <div key={area}>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{area}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {areaTables.map((table) => {
                  const cfg = STATUS_CONFIG[table.status];
                  const duration = table.activeOrder?.durationMinutes ?? 0;
                  return (
                    <div
                      key={table.id}
                      className={`bg-white rounded-xl border-2 p-4 ${cfg.bg} transition-all`}
                    >
                      {/* Table header */}
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-2xl font-bold text-gray-900">#{table.number}</p>
                            <span className={`w-2 h-2 rounded-full ${cfg.dot} animate-pulse`} />
                          </div>
                          {table.name && (
                            <p className="text-xs text-gray-500">{table.name}</p>
                          )}
                        </div>
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${cfg.color} ${cfg.bg}`}>
                          {cfg.label}
                        </span>
                      </div>

                      {/* Duration */}
                      {table.activeOrder && (
                        <div className="flex items-center gap-1.5 mb-3">
                          <Clock className={`w-4 h-4 ${getDurationColor(duration)}`} />
                          <span className={`text-sm font-semibold ${getDurationColor(duration)}`}>
                            {formatDuration(duration)}
                          </span>
                          <span className="text-xs text-gray-400">
                            sejak {new Date(table.activeOrder.openedAt).toLocaleTimeString("id-ID", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      )}

                      {/* Note */}
                      {table.activeOrder?.note && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-2.5 py-1.5 mb-3">
                          <p className="text-xs text-yellow-800 italic">{table.activeOrder.note}</p>
                        </div>
                      )}

                      {/* Actions */}
                      {table.status === "OCCUPIED" && (
                        <button
                          onClick={() => handleRequestBill(table.id)}
                          disabled={updatingStatus === table.id}
                          className="w-full mt-1 px-3 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                          {updatingStatus === table.id ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <AlertCircle className="w-3.5 h-3.5" />
                          )}
                          Minta Bill
                        </button>
                      )}
                      {table.status === "BILL" && (
                        <div className="w-full mt-1 px-3 py-2 bg-orange-100 text-orange-700 text-sm font-medium rounded-lg text-center">
                          Menunggu Pembayaran
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
