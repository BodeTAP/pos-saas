"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toaster";
import { formatCurrency } from "@/lib/utils";
import {
  ArrowLeft, Clock, Users, AlertCircle, CheckCircle,
  Loader2, ShoppingCart, X, Printer, Flame, Bell, ArrowRightLeft,
} from "lucide-react";
import Link from "next/link";
import { type KitchenReceiptData } from "@/components/pos/receipt";

type OrderItemStatus = "PENDING" | "COOKING" | "READY" | "SERVED" | "CANCELLED";

interface OrderItem {
  id: string;
  status: OrderItemStatus;
  productName: string;
  variantLabel: string | null;
  quantity: number;
  unitPrice: number;
  note: string | null;
  sentAt: string;
  modifiers: Array<{
    groupName: string;
    optionName: string;
    extraPrice: number;
  }>;
}

interface ActiveOrder {
  id: string;
  openedAt: string;
  note: string | null;
  isPaid: boolean;
  transaction: {
    id: string;
    invoiceNumber: string;
    total: number;
    status: string;
  } | null;
  orderItems: OrderItem[];
}

interface TableDetailClientProps {
  table: {
    id: string;
    number: string;
    name: string | null;
    area: string | null;
    capacity: number;
    status: string;
    outletId: string;
    outletName: string;
  };
  activeOrder: ActiveOrder | null;
  serviceChargePct: number;
  taxRate: number;
  isOwner?: boolean;
  availableTables?: Array<{ id: string; number: string; name: string | null; area: string | null; capacity: number }>;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  EMPTY: { label: "Kosong", color: "text-green-700", bg: "bg-green-50 border-green-200" },
  OCCUPIED: { label: "Terisi", color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
  BILL: { label: "Minta Bill", color: "text-orange-700", bg: "bg-orange-50 border-orange-200" },
  RESERVED: { label: "Dipesan", color: "text-purple-700", bg: "bg-purple-50 border-purple-200" },
};

const ITEM_STATUS_CONFIG: Record<OrderItemStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  PENDING: { label: "Antri", color: "text-gray-600", bg: "bg-gray-100", icon: Clock },
  COOKING: { label: "Dimasak", color: "text-orange-700", bg: "bg-orange-100", icon: Flame },
  READY: { label: "Siap", color: "text-green-700", bg: "bg-green-100", icon: Bell },
  SERVED: { label: "Disajikan", color: "text-blue-600", bg: "bg-blue-100", icon: CheckCircle },
  CANCELLED: { label: "Dibatalkan", color: "text-red-500", bg: "bg-red-100", icon: X },
};

export function TableDetailClient({
  table,
  activeOrder,
  serviceChargePct,
  taxRate,
  isOwner = false,
  availableTables = [],
}: TableDetailClientProps) {
  const router = useRouter();
  const [status, setStatus] = useState(table.status);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isForceClosing, setIsForceClosing] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const orderItems = activeOrder?.orderItems ?? [];

  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.EMPTY;
  const durationMinutes = activeOrder
    ? Math.floor((Date.now() - new Date(activeOrder.openedAt).getTime()) / 60000)
    : 0;

  // Hitung estimasi total dari OrderItems (sebelum bayar)
  const activeOrderItems = orderItems.filter((i) => i.status !== "CANCELLED");
  const subtotal = activeOrderItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const serviceCharge = subtotal * (serviceChargePct / 100);
  const tax = (subtotal + serviceCharge) * (taxRate / 100);
  const total = subtotal + serviceCharge + tax;

  async function handleRequestBill() {
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/tables/${table.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "BILL" }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Gagal update status.");
        return;
      }
      setStatus("BILL");
      toast.success("Status meja diubah ke Minta Bill.");
    } catch {
      toast.error("Terjadi kesalahan.");
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleCancelOrder() {
    if (!activeOrder) return;
    if (!confirm("Batalkan order meja ini? Meja akan dikosongkan.")) return;
    setIsCancelling(true);
    try {
      const res = await fetch(`/api/tables/${table.id}/order`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Gagal membatalkan order.");
        return;
      }
      toast.success("Order dibatalkan. Meja dikosongkan.");
      router.push("/dashboard/tables");
      router.refresh();
    } catch {
      toast.error("Terjadi kesalahan.");
    } finally {
      setIsCancelling(false);
    }
  }

  async function handleMove(targetTableId: string) {
    if (!activeOrder) return;
    setIsMoving(true);
    try {
      const res = await fetch(`/api/table-orders/${activeOrder.id}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetTableId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Gagal memindahkan meja.");
        return;
      }
      toast.success(data.message || "Meja berhasil dipindahkan.");
      setShowMoveModal(false);
      router.push(`/dashboard/tables/${targetTableId}`);
      router.refresh();
    } catch {
      toast.error("Terjadi kesalahan.");
    } finally {
      setIsMoving(false);
    }
  }

  async function handleForceClose() {
    if (!activeOrder) return;
    if (!confirm(
      "Tutup paksa order meja ini?\n\n" +
      "Semua item akan ditandai SERVED dan meja jadi EMPTY. Gunakan ini untuk membersihkan order yang stuck/tidak bisa ditutup normal.\n\n" +
      "Aksi ini tidak bisa dibatalkan."
    )) return;
    setIsForceClosing(true);
    try {
      const res = await fetch(`/api/tables/${table.id}/order?force=true`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Gagal menutup order.");
        return;
      }
      toast.success("Order berhasil ditutup paksa. Meja dikosongkan.");
      router.push("/dashboard/tables");
      router.refresh();
    } catch {
      toast.error("Terjadi kesalahan.");
    } finally {
      setIsForceClosing(false);
    }
  }

  function handlePrintKitchen() {
    if (!activeOrder || activeOrderItems.length === 0) return;
    const kitchenData: KitchenReceiptData = {
      invoiceNumber: `TABLE-${table.number}`,
      tableNumber: table.number,
      tableArea: table.area,
      cashierName: null,
      note: activeOrder.note,
      createdAt: new Date(activeOrder.openedAt),
      items: activeOrderItems.map((item) => ({
        name: item.variantLabel ? `${item.productName} (${item.variantLabel})` : item.productName,
        quantity: item.quantity,
        modifiers: item.modifiers.map((m) => ({
          groupName: m.groupName,
          optionName: m.optionName,
        })),
        note: item.note ?? undefined,
      })),
    };

    const html = renderKitchenReceiptHTML(kitchenData);
    const win = window.open("", "_blank", "width=400,height=600");
    if (win) {
      win.document.write(`
        <html><head><title>Struk Dapur</title>
        <style>
          body { font-family: monospace; margin: 0; padding: 8px; }
          @media print { body { margin: 0; } }
        </style>
        </head><body>${html}</body></html>
      `);
      win.document.close();
      win.focus();
      setTimeout(() => { win.print(); win.close(); }, 300);
    }
  }

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Back */}
      <Link
        href="/dashboard/tables"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="w-4 h-4" />
        Kembali ke Daftar Meja
      </Link>

      {/* Table Info */}
      <div className={`bg-white rounded-xl border-2 p-5 ${cfg.bg}`}>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">Meja #{table.number}</h1>
              <span className={`text-sm font-semibold px-2.5 py-1 rounded-full ${cfg.color} ${cfg.bg}`}>
                {cfg.label}
              </span>
            </div>
            {table.name && <p className="text-gray-500 text-sm mt-0.5">{table.name}</p>}
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
              {table.area && <span>📍 {table.area}</span>}
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                {table.capacity} orang
              </span>
              <span className="text-xs text-gray-400">{table.outletName}</span>
            </div>
          </div>
        </div>

        {/* Duration */}
        {activeOrder && (
          <div className="mt-3 flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-gray-400" />
            <span className="text-gray-600">
              Buka sejak{" "}
              {new Date(activeOrder.openedAt).toLocaleTimeString("id-ID", {
                hour: "2-digit",
                minute: "2-digit",
              })}
              {" "}({durationMinutes} menit)
            </span>
          </div>
        )}

        {/* Note */}
        {activeOrder?.note && (
          <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
            <p className="text-sm text-yellow-800 italic">📝 {activeOrder.note}</p>
          </div>
        )}

        {/* Sudah dibayar */}
        {activeOrder?.isPaid && activeOrder.transaction && (
          <div className="mt-3 bg-green-50 border border-green-200 rounded-lg px-3 py-2 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
            <p className="text-sm text-green-800">
              Sudah dibayar · Invoice {activeOrder.transaction.invoiceNumber}
            </p>
          </div>
        )}
      </div>

      {/* No active order */}
      {!activeOrder && (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-3" />
          <p className="text-gray-500">Tidak ada order aktif di meja ini.</p>
          <Link
            href="/dashboard/pos"
            className="mt-4 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium"
          >
            <ShoppingCart className="w-4 h-4" />
            Buka POS
          </Link>
        </div>
      )}

      {/* Order Items (dari dapur) */}
      {activeOrder && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">Item Pesanan</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {activeOrderItems.length} item · dikirim ke dapur
              </p>
            </div>
            {activeOrderItems.length > 0 && (
              <button
                onClick={handlePrintKitchen}
                className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <Printer className="w-3.5 h-3.5" />
                Struk Dapur
              </button>
            )}
          </div>

          {activeOrderItems.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-gray-400 text-sm">Belum ada item dikirim ke dapur.</p>
              <p className="text-gray-400 text-xs mt-1">Tambahkan item di POS lalu klik "Kirim ke Dapur".</p>
              <Link
                href="/dashboard/pos"
                className="mt-3 inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                Buka POS
              </Link>
            </div>
          ) : (
            <>
              <div className="divide-y divide-gray-100">
                {activeOrderItems.map((item) => {
                  const itemCfg = ITEM_STATUS_CONFIG[item.status];
                  const ItemIcon = itemCfg.icon;
                  return (
                    <div key={item.id} className="px-5 py-3">
                      <div className="flex justify-between items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-gray-900 text-sm">
                            {item.quantity}x {item.productName}
                            {item.variantLabel && (
                              <span className="text-gray-500 font-normal"> ({item.variantLabel})</span>
                            )}
                          </p>
                          {/* Modifiers */}
                          {item.modifiers.length > 0 && (
                            <div className="mt-0.5 space-y-0.5">
                              {item.modifiers.map((mod, i) => (
                                <p key={i} className="text-xs text-gray-500">
                                  + {mod.optionName}
                                  {mod.extraPrice > 0 && (
                                    <span className="text-gray-400"> (+{formatCurrency(mod.extraPrice)})</span>
                                  )}
                                </p>
                              ))}
                            </div>
                          )}
                          {/* Note */}
                          {item.note && (
                            <p className="text-xs text-amber-700 italic mt-0.5">! {item.note}</p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${itemCfg.color} ${itemCfg.bg}`}>
                            <ItemIcon className="w-3 h-3" />
                            {itemCfg.label}
                          </span>
                          <p className="text-sm font-medium text-gray-900">
                            {formatCurrency(item.unitPrice * item.quantity)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Totals */}
              <div className="px-5 py-4 border-t border-gray-200 bg-gray-50 space-y-1.5">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {serviceChargePct > 0 && (
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Service Charge ({serviceChargePct}%)</span>
                    <span>{formatCurrency(serviceCharge)}</span>
                  </div>
                )}
                {taxRate > 0 && (
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>PPN ({taxRate}%)</span>
                    <span>{formatCurrency(tax)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-gray-900 text-base pt-1 border-t border-gray-200">
                  <span>Estimasi Total</span>
                  <span>{formatCurrency(total)}</span>
                </div>
                <p className="text-xs text-gray-400">* Total final dihitung saat pembayaran di POS</p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Actions — saat belum dibayar */}
      {activeOrder && !activeOrder.isPaid && (
        <div className="flex flex-col sm:flex-row gap-3">
          {status === "OCCUPIED" && (
            <button
              onClick={handleRequestBill}
              disabled={isUpdating}
              className="flex-1 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-medium py-3 rounded-xl transition-colors"
            >
              {isUpdating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <AlertCircle className="w-4 h-4" />
              )}
              Minta Bill
            </button>
          )}

          <Link
            href={`/dashboard/pos?tableId=${table.id}`}
            className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition-colors"
          >
            <ShoppingCart className="w-4 h-4" />
            Bayar di POS
          </Link>

          {availableTables.length > 0 && (
            <button
              onClick={() => setShowMoveModal(true)}
              disabled={isMoving}
              className="flex items-center justify-center gap-2 px-4 py-3 border border-blue-300 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors disabled:opacity-50"
              title="Pindahkan order ke meja lain"
            >
              <ArrowRightLeft className="w-4 h-4" />
              Pindah Meja
            </button>
          )}

          {!activeOrder.transaction && (
            <button
              onClick={handleCancelOrder}
              disabled={isCancelling}
              className="flex items-center justify-center gap-2 px-4 py-3 border border-red-300 text-red-600 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-50"
            >
              {isCancelling ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <X className="w-4 h-4" />
              )}
              Batalkan Order
            </button>
          )}
        </div>
      )}

      {/* Actions — saat sudah dibayar (PAY_FIRST flow) */}
      {activeOrder && activeOrder.isPaid && (
        <div className="space-y-2">
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800">
            💡 Tandai semua item <strong>SERVED</strong> di Kitchen Display agar meja otomatis tutup.
          </div>
          {isOwner && (
            <button
              onClick={handleForceClose}
              disabled={isForceClosing}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-red-300 text-red-600 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-50"
            >
              {isForceClosing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <X className="w-4 h-4" />
              )}
              Tutup Paksa (Owner)
            </button>
          )}
        </div>
      )}

      {/* Modal pindah meja */}
      {showMoveModal && availableTables.length > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Pindah Meja</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Pindah dari Meja #{table.number} ke meja kosong
                </p>
              </div>
              <button onClick={() => setShowMoveModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-3 space-y-2">
              {availableTables.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleMove(t.id)}
                  disabled={isMoving}
                  className="w-full text-left p-3 rounded-xl border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-colors disabled:opacity-50"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">Meja #{t.number}</p>
                      <p className="text-xs text-gray-500">
                        {t.name && `${t.name} · `}
                        {t.area && `${t.area} · `}
                        {t.capacity} orang
                      </p>
                    </div>
                    {isMoving && <Loader2 className="w-4 h-4 animate-spin text-blue-600" />}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper: render kitchen receipt sebagai HTML string
function renderKitchenReceiptHTML(data: KitchenReceiptData): string {
  const formatTime = (d: Date) =>
    d.toLocaleString("id-ID", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

  const itemsHTML = data.items
    .map(
      (item) => `
      <div style="margin-bottom:8px">
        <div style="display:flex;gap:8px">
          <strong style="width:24px;text-align:right">${item.quantity}x</strong>
          <strong>${item.name}</strong>
        </div>
        ${
          item.modifiers && item.modifiers.length > 0
            ? item.modifiers
                .map((m) => `<div style="padding-left:32px;font-size:12px">→ ${m.optionName}</div>`)
                .join("")
            : ""
        }
        ${item.note ? `<div style="padding-left:32px;font-size:12px;font-style:italic">! ${item.note}</div>` : ""}
      </div>
    `
    )
    .join("");

  return `
    <div style="font-family:monospace;width:80mm;padding:4mm;font-size:12px;line-height:1.5">
      <div style="text-align:center;margin-bottom:8px">
        <strong style="font-size:14px">*** STRUK DAPUR ***</strong><br>
        <strong style="font-size:18px">${data.tableNumber ? `MEJA #${data.tableNumber}${data.tableArea ? ` — ${data.tableArea}` : ""}` : "TAKEAWAY"}</strong>
      </div>
      <div style="text-align:center">================================</div>
      <div style="font-size:11px;margin:4px 0">
        <div style="display:flex;justify-content:space-between"><span>No.</span><span>${data.invoiceNumber}</span></div>
        <div style="display:flex;justify-content:space-between"><span>Waktu</span><span>${formatTime(data.createdAt)}</span></div>
      </div>
      <div style="text-align:center">================================</div>
      <div style="margin:8px 0">${itemsHTML}</div>
      <div style="text-align:center">--------------------------------</div>
      ${data.note ? `<div style="font-style:italic;text-align:center;font-size:11px">Catatan: ${data.note}</div>` : ""}
      <div style="text-align:center;font-size:11px;margin-top:4px">*** SEGERA DIPROSES ***</div>
    </div>
  `;
}
