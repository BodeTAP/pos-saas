"use client";

import { useState, useEffect, useCallback } from "react";
import {
  X, Loader2, CheckCircle, XCircle, ShoppingCart,
  AlertTriangle, Clock, Package, Truck, RefreshCw,
} from "lucide-react";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type POStatus = "DRAFT" | "ORDERED" | "PARTIAL" | "RECEIVED" | "CANCELLED";

interface POItem {
  id: string;
  productId: string;
  productName: string;
  productSku: string | null;
  quantity: number;
  quantityReceived: number;
  buyPrice: number;
  note: string | null;
  product: { name: string; unit: string; buyPrice: number };
}

interface PODetail {
  id: string;
  poNumber: string;
  status: POStatus;
  supplierName: string | null;
  supplierPhone: string | null;
  note: string | null;
  totalCost: number;
  totalItems: number;
  expectedDate: string | null;
  receivedAt: string | null;
  createdAt: string;
  outlet: { id: string; name: string };
  items: POItem[];
}

interface ReceiveItem {
  itemId: string;
  quantityReceived: number;
  buyPrice?: number;
}

const STATUS_CONFIG: Record<POStatus, { label: string; color: string; icon: React.ElementType }> = {
  DRAFT: { label: "Draft", color: "bg-gray-100 text-gray-700", icon: Clock },
  ORDERED: { label: "Dipesan", color: "bg-blue-100 text-blue-700", icon: ShoppingCart },
  PARTIAL: { label: "Sebagian Diterima", color: "bg-orange-100 text-orange-700", icon: AlertTriangle },
  RECEIVED: { label: "Diterima", color: "bg-green-100 text-green-700", icon: CheckCircle },
  CANCELLED: { label: "Dibatalkan", color: "bg-red-100 text-red-700", icon: XCircle },
};

// BUG 9: onUpdated now accepts full updated order data including items for qty recalculation
interface PODetailModalProps {
  poId: string;
  onClose: () => void;
  onUpdated: (order: {
    id: string;
    status: POStatus;
    receivedAt: string | null;
    totalCost?: number;
    items?: Array<{ quantity: number; quantityReceived: number }>;
  }) => void;
}

export function PODetailModal({ poId, onClose, onUpdated }: PODetailModalProps) {
  const [order, setOrder] = useState<PODetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"detail" | "receive">("detail");
  const [receiveItems, setReceiveItems] = useState<ReceiveItem[]>([]);
  const [receiveNote, setReceiveNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  // BUG 20: inline cancel confirmation state instead of window.confirm()
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // BUG 25: wrap fetchOrder in useCallback with proper dependencies
  const fetchOrder = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/purchase-orders/${poId}`);
      if (res.ok) {
        const data = await res.json();
        setOrder(data.order);
        // Init receive items with remaining qty
        setReceiveItems(
          data.order.items
            .filter((i: POItem) => i.quantity > i.quantityReceived)
            .map((i: POItem) => ({
              itemId: i.id,
              quantityReceived: i.quantity - i.quantityReceived,
              buyPrice: i.buyPrice,
            }))
        );
      }
    } finally {
      setLoading(false);
    }
  }, [poId]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  async function handleStatusChange(newStatus: "ORDERED" | "CANCELLED") {
    if (!order) return;

    try {
      // BUG 11: don't send Content-Type: application/json for DELETE requests
      const res = await fetch(`/api/purchase-orders/${poId}`, {
        method: newStatus === "CANCELLED" ? "DELETE" : "PUT",
        ...(newStatus !== "CANCELLED" && {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Gagal mengubah status."); return; }

      const updated = newStatus === "CANCELLED"
        ? { ...order, status: "CANCELLED" as POStatus }
        : data.order;
      setOrder(updated);
      // BUG 9: pass full updated data to onUpdated
      onUpdated({
        id: updated.id,
        status: updated.status,
        receivedAt: updated.receivedAt,
        totalCost: updated.totalCost,
        items: updated.items,
      });
      setShowCancelConfirm(false);
      toast.success(newStatus === "CANCELLED" ? "PO dibatalkan." : "Status PO diperbarui.");
    } catch {
      toast.error("Terjadi kesalahan.");
    }
  }

  async function handleReceive() {
    if (!order) return;
    const validItems = receiveItems.filter((i) => i.quantityReceived > 0);
    if (validItems.length === 0) {
      toast.error("Isi jumlah diterima untuk minimal 1 produk.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/purchase-orders/${poId}/receive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: validItems, note: receiveNote || null }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Gagal mencatat penerimaan."); return; }

      setOrder(data.order);
      // BUG 9: pass full updated order data including items for qty recalculation
      onUpdated({
        id: data.order.id,
        status: data.order.status,
        receivedAt: data.order.receivedAt,
        totalCost: data.order.totalCost,
        items: data.order.items,
      });
      toast.success("Penerimaan barang berhasil dicatat. Stok sudah diperbarui.");
      setActiveTab("detail");
      await fetchOrder();
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
        </div>
      </div>
    );
  }

  if (!order) return null;

  const statusCfg = STATUS_CONFIG[order.status];
  const StatusIcon = statusCfg.icon;
  const canReceive = order.status !== "RECEIVED" && order.status !== "CANCELLED";
  const canMarkOrdered = order.status === "DRAFT";
  const canCancel = order.status === "DRAFT" || order.status === "ORDERED";
  const pendingItems = order.items.filter((i) => i.quantity > i.quantityReceived);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-200 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-900">{order.poNumber}</h2>
              <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1", statusCfg.color)}>
                <StatusIcon className="w-3 h-3" />
                {statusCfg.label}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              {order.outlet.name} · {formatDateTime(order.createdAt)}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        {canReceive && pendingItems.length > 0 && (
          <div className="flex border-b border-gray-200 flex-shrink-0">
            {[
              { id: "detail", label: "Detail PO" },
              { id: "receive", label: `Terima Barang (${pendingItems.length} produk)` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as "detail" | "receive")}
                className={cn(
                  "px-5 py-3 text-sm font-medium border-b-2 transition-colors",
                  activeTab === tab.id
                    ? "border-blue-600 text-blue-700"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {activeTab === "detail" ? (
            <div className="p-5 space-y-4">
              {/* Info supplier */}
              {(order.supplierName || order.expectedDate || order.note) && (
                <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                  {order.supplierName && (
                    <div className="flex items-center gap-2">
                      <Truck className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-700 font-medium">{order.supplierName}</span>
                      {order.supplierPhone && (
                        <span className="text-gray-500">· {order.supplierPhone}</span>
                      )}
                    </div>
                  )}
                  {order.expectedDate && (
                    <p className="text-gray-600">
                      Estimasi tiba: <strong>{formatDate(order.expectedDate)}</strong>
                    </p>
                  )}
                  {order.receivedAt && (
                    <p className="text-green-700">
                      Diterima: <strong>{formatDateTime(order.receivedAt)}</strong>
                    </p>
                  )}
                  {order.note && <p className="text-gray-500 italic">{order.note}</p>}
                </div>
              )}

              {/* Items */}
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Daftar Produk</p>
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left px-3 py-2 font-medium text-gray-600">Produk</th>
                        <th className="text-right px-3 py-2 font-medium text-gray-600">Dipesan</th>
                        <th className="text-right px-3 py-2 font-medium text-gray-600">Diterima</th>
                        <th className="text-right px-3 py-2 font-medium text-gray-600">Harga Beli</th>
                        <th className="text-right px-3 py-2 font-medium text-gray-600">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {order.items.map((item) => {
                        const isComplete = item.quantityReceived >= item.quantity;
                        return (
                          <tr key={item.id} className={isComplete ? "bg-green-50" : ""}>
                            <td className="px-3 py-2">
                              <p className="font-medium text-gray-900">{item.productName}</p>
                              {item.productSku && (
                                <p className="text-xs text-gray-400">{item.productSku}</p>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right text-gray-700">
                              {item.quantity} {item.product.unit}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <span className={cn(
                                "font-medium",
                                isComplete ? "text-green-700" :
                                item.quantityReceived > 0 ? "text-orange-700" : "text-gray-400"
                              )}>
                                {item.quantityReceived} {item.product.unit}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right text-gray-700">
                              {formatCurrency(item.buyPrice)}
                            </td>
                            <td className="px-3 py-2 text-right font-medium text-gray-900">
                              {formatCurrency(item.quantity * item.buyPrice)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 border-t border-gray-200">
                        <td colSpan={4} className="px-3 py-2 text-right font-semibold text-gray-700">
                          Total
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-gray-900">
                          {formatCurrency(order.totalCost)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            /* Tab Terima Barang */
            <div className="p-5 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-800">
                Isi jumlah barang yang diterima. Stok akan otomatis bertambah setelah disimpan.
              </div>

              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-3 py-2 font-medium text-gray-600">Produk</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-600">Sisa Pesanan</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-600 w-28">Diterima</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-600 w-32">Harga Beli</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pendingItems.map((item) => {
                      const ri = receiveItems.find((r) => r.itemId === item.id);
                      const remaining = item.quantity - item.quantityReceived;
                      return (
                        <tr key={item.id}>
                          <td className="px-3 py-2">
                            <p className="font-medium text-gray-900">{item.productName}</p>
                            {item.productSku && (
                              <p className="text-xs text-gray-400">{item.productSku}</p>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-700">
                            {remaining} {item.product.unit}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              min={0}
                              max={remaining}
                              value={ri?.quantityReceived ?? 0}
                              onChange={(e) => {
                                const val = Math.min(remaining, Math.max(0, parseInt(e.target.value) || 0));
                                setReceiveItems((prev) => {
                                  const exists = prev.find((r) => r.itemId === item.id);
                                  if (exists) return prev.map((r) => r.itemId === item.id ? { ...r, quantityReceived: val } : r);
                                  return [...prev, { itemId: item.id, quantityReceived: val, buyPrice: item.buyPrice }];
                                });
                              }}
                              className="w-24 px-2 py-1 border border-gray-300 rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              min={0}
                              value={ri?.buyPrice ?? item.buyPrice}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setReceiveItems((prev) => {
                                  const exists = prev.find((r) => r.itemId === item.id);
                                  if (exists) return prev.map((r) => r.itemId === item.id ? { ...r, buyPrice: val } : r);
                                  return [...prev, { itemId: item.id, quantityReceived: 0, buyPrice: val }];
                                });
                              }}
                              className="w-28 px-2 py-1 border border-gray-300 rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Catatan Penerimaan
                </label>
                <input
                  value={receiveNote}
                  onChange={(e) => setReceiveNote(e.target.value)}
                  placeholder="Contoh: Barang tiba dalam kondisi baik"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex gap-2 p-5 border-t border-gray-200 flex-shrink-0 flex-wrap">
          {activeTab === "detail" ? (
            <>
              {canMarkOrdered && (
                <button
                  onClick={() => handleStatusChange("ORDERED")}
                  className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors"
                >
                  <ShoppingCart className="w-4 h-4" />
                  Tandai Dipesan
                </button>
              )}
              {canReceive && pendingItems.length > 0 && (
                <button
                  onClick={() => setActiveTab("receive")}
                  className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium transition-colors"
                >
                  <Package className="w-4 h-4" />
                  Terima Barang
                </button>
              )}
              {/* BUG 20: inline cancel confirmation instead of window.confirm() */}
              {canCancel && !showCancelConfirm && (
                <button
                  onClick={() => setShowCancelConfirm(true)}
                  className="flex items-center gap-2 px-4 py-2.5 border border-red-300 text-red-600 hover:bg-red-50 rounded-xl text-sm font-medium transition-colors"
                >
                  <XCircle className="w-4 h-4" />
                  Batalkan PO
                </button>
              )}
              {canCancel && showCancelConfirm && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                  <span className="text-sm text-red-700 font-medium">Yakin batalkan PO ini?</span>
                  <button
                    onClick={() => handleStatusChange("CANCELLED")}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium transition-colors"
                  >
                    Ya, Batalkan
                  </button>
                  <button
                    onClick={() => setShowCancelConfirm(false)}
                    className="px-3 py-1 border border-gray-300 text-gray-600 hover:bg-gray-50 rounded-lg text-xs font-medium transition-colors"
                  >
                    Tidak
                  </button>
                </div>
              )}
              <button
                onClick={onClose}
                className="ml-auto px-4 py-2.5 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl text-sm font-medium transition-colors"
              >
                Tutup
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setActiveTab("detail")}
                className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Kembali
              </button>
              <button
                onClick={handleReceive}
                disabled={isSubmitting}
                className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-medium py-2.5 rounded-xl text-sm transition-colors"
              >
                {isSubmitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...</>
                ) : (
                  <><CheckCircle className="w-4 h-4" /> Simpan Penerimaan</>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
