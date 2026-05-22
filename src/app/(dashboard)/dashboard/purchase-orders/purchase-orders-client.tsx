"use client";

import { useState } from "react";
import {
  Plus, ShoppingCart, Clock, CheckCircle, XCircle,
  AlertTriangle, Package, ChevronRight, Filter,
} from "lucide-react";
// BUG 23: merged duplicate imports from @/lib/utils into one
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { CreatePOModal } from "@/components/purchase-orders/create-po-modal";
import { PODetailModal } from "@/components/purchase-orders/po-detail-modal";
// BUG 10: removed unused Pagination import

type POStatus = "DRAFT" | "ORDERED" | "PARTIAL" | "RECEIVED" | "CANCELLED";

interface POSummary {
  id: string;
  poNumber: string;
  status: POStatus;
  supplierName: string | null;
  totalCost: number;
  totalItems: number;
  itemCount: number;
  totalQty: number;
  receivedQty: number;
  expectedDate: Date | null;
  receivedAt: Date | null;
  createdAt: Date;
  outlet: { name: string };
}

interface OutletInfo {
  id: string;
  name: string;
  isMain: boolean;
}

interface PurchaseOrdersClientProps {
  initialOrders: POSummary[];
  outlets: OutletInfo[];
}

const STATUS_CONFIG: Record<POStatus, { label: string; color: string; icon: React.ElementType }> = {
  DRAFT: { label: "Draft", color: "bg-gray-100 text-gray-700", icon: Clock },
  ORDERED: { label: "Dipesan", color: "bg-blue-100 text-blue-700", icon: ShoppingCart },
  PARTIAL: { label: "Sebagian Diterima", color: "bg-orange-100 text-orange-700", icon: AlertTriangle },
  RECEIVED: { label: "Diterima", color: "bg-green-100 text-green-700", icon: CheckCircle },
  CANCELLED: { label: "Dibatalkan", color: "bg-red-100 text-red-700", icon: XCircle },
};

export function PurchaseOrdersClient({ initialOrders, outlets }: PurchaseOrdersClientProps) {
  const [orders, setOrders] = useState<POSummary[]>(initialOrders);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedPOId, setSelectedPOId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<POStatus | "">("");

  const filtered = statusFilter
    ? orders.filter((o) => o.status === statusFilter)
    : orders;

  function handleCreated(order: POSummary) {
    setOrders((prev) => [order, ...prev]);
    setShowCreate(false);
  }

  // BUG 9: handleUpdated now also updates receivedQty, totalQty, and totalCost
  function handleUpdated(order: {
    id: string;
    status: POSummary["status"];
    receivedAt: string | null;
    totalCost?: number;
    items?: Array<{ quantity: number; quantityReceived: number }>;
  }) {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== order.id) return o;
        // Recalculate totalQty and receivedQty from items if provided
        const totalQty =
          order.items != null
            ? order.items.reduce((s, i) => s + i.quantity, 0)
            : o.totalQty;
        const receivedQty =
          order.items != null
            ? order.items.reduce((s, i) => s + i.quantityReceived, 0)
            : o.receivedQty;
        return {
          ...o,
          status: order.status,
          receivedAt: order.receivedAt ? new Date(order.receivedAt) : null,
          ...(order.totalCost !== undefined && { totalCost: order.totalCost }),
          totalQty,
          receivedQty,
        };
      })
    );
  }

  const stats = {
    draft: orders.filter((o) => o.status === "DRAFT").length,
    ordered: orders.filter((o) => o.status === "ORDERED").length,
    partial: orders.filter((o) => o.status === "PARTIAL").length,
    received: orders.filter((o) => o.status === "RECEIVED").length,
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Purchase Order</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Kelola pembelian dan penerimaan barang dari supplier
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-medium transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Buat PO Baru
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { key: "draft", label: "Draft", color: "text-gray-700", bg: "bg-gray-50", border: "border-gray-200" },
          { key: "ordered", label: "Dipesan", color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200" },
          { key: "partial", label: "Sebagian", color: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200" },
          { key: "received", label: "Diterima", color: "text-green-700", bg: "bg-green-50", border: "border-green-200" },
        ].map((s) => (
          <button
            key={s.key}
            onClick={() => setStatusFilter(statusFilter === s.key.toUpperCase() as POStatus ? "" : s.key.toUpperCase() as POStatus)}
            className={cn(
              "rounded-xl border p-4 text-left transition-all",
              s.bg, s.border,
              statusFilter === s.key.toUpperCase() ? "ring-2 ring-offset-1 ring-blue-400" : "hover:opacity-80"
            )}
          >
            <p className={cn("text-2xl font-bold", s.color)}>
              {stats[s.key as keyof typeof stats]}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Filter bar */}
      {statusFilter && (
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-600">
            Filter: <strong>{STATUS_CONFIG[statusFilter]?.label}</strong>
          </span>
          <button
            onClick={() => setStatusFilter("")}
            className="text-xs text-blue-600 hover:underline"
          >
            Hapus filter
          </button>
        </div>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <Package className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">Belum ada Purchase Order</p>
          <p className="text-sm text-gray-400 mt-1">
            Buat PO baru untuk mencatat pembelian dari supplier
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-4 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Buat PO Pertama
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => {
            const statusCfg = STATUS_CONFIG[order.status];
            const StatusIcon = statusCfg.icon;
            const progress = order.totalQty > 0
              ? Math.round((order.receivedQty / order.totalQty) * 100)
              : 0;

            return (
              <button
                key={order.id}
                onClick={() => setSelectedPOId(order.id)}
                className="w-full bg-white rounded-xl border border-gray-200 p-4 text-left hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900">{order.poNumber}</p>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1", statusCfg.color)}>
                        <StatusIcon className="w-3 h-3" />
                        {statusCfg.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                      <span>{order.outlet.name}</span>
                      {order.supplierName && (
                        <span>· {order.supplierName}</span>
                      )}
                      <span>· {formatDate(order.createdAt)}</span>
                      {order.expectedDate && order.status !== "RECEIVED" && (
                        <span className="text-orange-600">
                          · Estimasi: {formatDate(order.expectedDate)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-semibold text-gray-900">{formatCurrency(order.totalCost)}</p>
                    <p className="text-xs text-gray-500">{order.itemCount} produk</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />
                </div>

                {/* Progress bar untuk PARTIAL */}
                {(order.status === "PARTIAL" || order.status === "ORDERED") && order.totalQty > 0 && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>Diterima: {order.receivedQty}/{order.totalQty} unit</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}
              </button>
            );
          })}
          {/* Pagination can be added here when the list grows beyond 20 items */}
        </div>
      )}

      {/* Modals */}
      {showCreate && (
        <CreatePOModal
          outlets={outlets}
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}

      {selectedPOId && (
        <PODetailModal
          poId={selectedPOId}
          onClose={() => setSelectedPOId(null)}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  );
}
