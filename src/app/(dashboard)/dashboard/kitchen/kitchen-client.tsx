"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "@/components/ui/toaster";
import {
  RefreshCw, Clock, UtensilsCrossed, CheckCircle,
  AlertCircle, ChefHat, Flame, Bell,
} from "lucide-react";

interface OrderItemModifier {
  groupName: string;
  optionName: string;
}

interface OrderItem {
  id: string;
  status: "PENDING" | "COOKING" | "READY" | "SERVED" | "CANCELLED";
  productName: string;
  variantLabel: string | null;
  quantity: number;
  note: string | null;
  sentAt: string;
  cookedAt: string | null;
  readyAt: string | null;
  servedAt: string | null;
  modifiers: OrderItemModifier[];
}

interface ActiveOrder {
  id: string;
  openedAt: string;
  note: string | null;
  durationMinutes: number;
  items: OrderItem[];
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

const TABLE_STATUS_CONFIG = {
  OCCUPIED: { label: "Terisi", color: "text-blue-700", bg: "bg-blue-50 border-blue-200", dot: "bg-blue-500" },
  BILL: { label: "Minta Bill", color: "text-orange-700", bg: "bg-orange-50 border-orange-200", dot: "bg-orange-500" },
};

const ITEM_STATUS_CONFIG: Record<OrderItem["status"], {
  label: string;
  color: string;
  bg: string;
  nextStatus?: OrderItem["status"];
  nextLabel?: string;
  icon: React.ElementType;
}> = {
  PENDING: {
    label: "Antri",
    color: "text-gray-600",
    bg: "bg-gray-100",
    nextStatus: "COOKING",
    nextLabel: "Mulai Masak",
    icon: Clock,
  },
  COOKING: {
    label: "Dimasak",
    color: "text-orange-700",
    bg: "bg-orange-100",
    nextStatus: "READY",
    nextLabel: "Siap Saji",
    icon: Flame,
  },
  READY: {
    label: "Siap",
    color: "text-green-700",
    bg: "bg-green-100",
    nextStatus: "SERVED",
    nextLabel: "Sudah Disajikan",
    icon: Bell,
  },
  SERVED: {
    label: "Disajikan",
    color: "text-blue-600",
    bg: "bg-blue-100",
    icon: CheckCircle,
  },
  CANCELLED: {
    label: "Dibatalkan",
    color: "text-red-500",
    bg: "bg-red-100",
    icon: AlertCircle,
  },
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
  const [updatingItem, setUpdatingItem] = useState<string | null>(null);
  const [updatingTableStatus, setUpdatingTableStatus] = useState<string | null>(null);

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

  async function handleUpdateItemStatus(tableId: string, itemId: string, newStatus: OrderItem["status"]) {
    setUpdatingItem(itemId);
    try {
      const res = await fetch(`/api/order-items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Gagal update status item.");
        return;
      }
      const data = await res.json();
      // Update item di state lokal
      setTables((prev) =>
        prev.map((t) => {
          if (t.id !== tableId || !t.activeOrder) return t;
          return {
            ...t,
            activeOrder: {
              ...t.activeOrder,
              items: t.activeOrder.items.map((i) =>
                i.id === itemId ? { ...i, ...data.item } : i
              ),
            },
          };
        })
      );
    } catch {
      toast.error("Terjadi kesalahan.");
    } finally {
      setUpdatingItem(null);
    }
  }

  async function handleRequestBill(tableId: string) {
    setUpdatingTableStatus(tableId);
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
      setUpdatingTableStatus(null);
    }
  }

  const areas = [...new Set(tables.map((t) => t.area || "Umum"))];
  const billCount = tables.filter((t) => t.status === "BILL").length;

  // Hitung item yang perlu perhatian (PENDING atau COOKING)
  const pendingItemCount = tables.reduce((sum, t) => {
    if (!t.activeOrder) return sum;
    return sum + t.activeOrder.items.filter((i) => i.status === "PENDING" || i.status === "COOKING").length;
  }, 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ChefHat className="w-6 h-6 text-gray-600" />
            Kitchen Display
          </h1>
          <p className="text-gray-500 mt-0.5 text-sm">
            {tables.length} meja aktif
            {pendingItemCount > 0 && (
              <span className="ml-2 text-orange-600 font-medium">· {pendingItemCount} item perlu diproses</span>
            )}
            {billCount > 0 && (
              <span className="ml-2 text-orange-600 font-medium">· {billCount} minta bill</span>
            )}
            · Update otomatis setiap 10 detik
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">
            {lastUpdated.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
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

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {(["PENDING", "COOKING", "READY", "SERVED"] as const).map((s) => {
          const cfg = ITEM_STATUS_CONFIG[s];
          const Icon = cfg.icon;
          return (
            <span key={s} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.color} ${cfg.bg}`}>
              <Icon className="w-3 h-3" />
              {cfg.label}
            </span>
          );
        })}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {areaTables.map((table) => {
                  const cfg = TABLE_STATUS_CONFIG[table.status];
                  const duration = table.activeOrder?.durationMinutes ?? 0;
                  const items = table.activeOrder?.items ?? [];
                  const activeItems = items.filter((i) => i.status !== "SERVED" && i.status !== "CANCELLED");
                  const allServed = items.length > 0 && items.every((i) => i.status === "SERVED" || i.status === "CANCELLED");

                  return (
                    <div
                      key={table.id}
                      className={`bg-white rounded-xl border-2 overflow-hidden ${cfg.bg} transition-all`}
                    >
                      {/* Table header */}
                      <div className="px-4 pt-4 pb-3">
                        <div className="flex items-start justify-between mb-2">
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
                          <div className="flex items-center gap-1.5">
                            <Clock className={`w-3.5 h-3.5 ${getDurationColor(duration)}`} />
                            <span className={`text-xs font-semibold ${getDurationColor(duration)}`}>
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
                          <div className="mt-2 bg-yellow-50 border border-yellow-200 rounded-lg px-2.5 py-1.5">
                            <p className="text-xs text-yellow-800 italic">📝 {table.activeOrder.note}</p>
                          </div>
                        )}
                      </div>

                      {/* Order Items */}
                      {items.length === 0 ? (
                        <div className="px-4 pb-4">
                          <p className="text-xs text-gray-400 text-center py-3 border border-dashed border-gray-200 rounded-lg">
                            Belum ada item dikirim ke dapur
                          </p>
                        </div>
                      ) : (
                        <div className="border-t border-gray-100">
                          {/* All served indicator */}
                          {allServed && (
                            <div className="px-4 py-2 bg-green-50 flex items-center gap-2">
                              <CheckCircle className="w-4 h-4 text-green-600" />
                              <p className="text-xs text-green-700 font-medium">Semua item sudah disajikan</p>
                            </div>
                          )}

                          <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
                            {activeItems.map((item) => {
                              const itemCfg = ITEM_STATUS_CONFIG[item.status];
                              const ItemIcon = itemCfg.icon;
                              const isUpdating = updatingItem === item.id;

                              return (
                                <div key={item.id} className="px-4 py-2.5">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-bold text-gray-900 text-sm">{item.quantity}x</span>
                                        <span className="font-medium text-gray-900 text-sm truncate">
                                          {item.productName}
                                          {item.variantLabel && (
                                            <span className="text-gray-500 font-normal"> ({item.variantLabel})</span>
                                          )}
                                        </span>
                                      </div>
                                      {/* Modifiers */}
                                      {item.modifiers.length > 0 && (
                                        <div className="mt-0.5 space-y-0.5">
                                          {item.modifiers.map((mod, i) => (
                                            <p key={i} className="text-xs text-gray-500 pl-4">
                                              → {mod.optionName}
                                            </p>
                                          ))}
                                        </div>
                                      )}
                                      {/* Note */}
                                      {item.note && (
                                        <p className="text-xs text-amber-700 italic pl-4 mt-0.5">
                                          ! {item.note}
                                        </p>
                                      )}
                                    </div>

                                    {/* Status badge + action */}
                                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${itemCfg.color} ${itemCfg.bg}`}>
                                        <ItemIcon className="w-3 h-3" />
                                        {itemCfg.label}
                                      </span>
                                      {itemCfg.nextStatus && (
                                        <button
                                          onClick={() => handleUpdateItemStatus(table.id, item.id, itemCfg.nextStatus!)}
                                          disabled={isUpdating}
                                          className="text-xs text-blue-600 hover:text-blue-800 hover:underline disabled:opacity-50"
                                        >
                                          {isUpdating ? "..." : itemCfg.nextLabel}
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Served items (collapsed) */}
                          {items.filter((i) => i.status === "SERVED").length > 0 && (
                            <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
                              <p className="text-xs text-gray-400">
                                ✓ {items.filter((i) => i.status === "SERVED").length} item sudah disajikan
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Table actions */}
                      <div className="px-4 pb-4 pt-2 space-y-2">
                        {table.status === "OCCUPIED" && (
                          <button
                            onClick={() => handleRequestBill(table.id)}
                            disabled={updatingTableStatus === table.id}
                            className="w-full px-3 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                          >
                            {updatingTableStatus === table.id ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <AlertCircle className="w-3.5 h-3.5" />
                            )}
                            Minta Bill
                          </button>
                        )}
                        {table.status === "BILL" && (
                          <div className="w-full px-3 py-2 bg-orange-100 text-orange-700 text-sm font-medium rounded-lg text-center">
                            Menunggu Pembayaran
                          </div>
                        )}
                      </div>
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
