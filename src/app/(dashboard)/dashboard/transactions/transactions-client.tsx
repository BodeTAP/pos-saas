"use client";

import { useState } from "react";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { ShoppingBag, Filter, RotateCcw } from "lucide-react";
import { ReprintButton } from "@/components/pos/reprint-button";
import { RefundModal } from "@/components/transactions/refund-modal";
import type { ReceiptData } from "@/components/pos/receipt";

interface TransactionItemModifier {
  modifierGroupName: string;
  modifierOptionName: string;
  extraPrice: number;
}

interface TransactionItem {
  id: string;
  productName: string;
  productSku: string | null;
  quantity: number;
  unitPrice: number;
  discount: number;
  subtotal: number;
  variantLabel?: string | null;
  modifiers?: TransactionItemModifier[];
}

interface TransactionData {
  id: string;
  invoiceNumber: string;
  status: string;
  paymentMethod: string;
  subtotal: number;
  discount: number;
  discountPct: number;
  serviceCharge?: number;
  serviceChargePct?: number;
  tax: number;
  taxPct: number;
  total: number;
  amountPaid: number;
  change: number;
  note: string | null;
  createdAt: Date | string;
  cashier: { name: string };
  outlet: { id: string; name: string } | null;
  customer: { name: string } | null;
  items: TransactionItem[];
  tableOrder?: { table: { number: string; area: string | null } } | null;
}

interface OutletSummary {
  id: string;
  name: string;
  isMain: boolean;
}

interface TenantInfo {
  name: string;
  address: string | null;
  phone: string | null;
  receiptWidth: number;
  receiptNote: string | null;
  receiptHeader?: string | null;
}

interface TransactionsClientProps {
  initialTransactions: TransactionData[];
  outlets: OutletSummary[];
  tenant: TenantInfo | null;
  isOwner?: boolean;
}

const paymentLabel: Record<string, string> = {
  CASH: "Tunai",
  QRIS: "QRIS",
  TRANSFER: "Transfer",
  CARD: "Kartu",
  OTHER: "Lainnya",
};

export function TransactionsClient({
  initialTransactions,
  outlets,
  tenant,
  isOwner = false,
}: TransactionsClientProps) {
  const [selectedOutlet, setSelectedOutlet] = useState<string>("ALL");
  const [transactions, setTransactions] = useState(initialTransactions);
  const [refundTarget, setRefundTarget] = useState<TransactionData | null>(null);

  const filtered =
    selectedOutlet === "ALL"
      ? transactions
      : transactions.filter((tx) => tx.outlet?.id === selectedOutlet);

  function buildReceiptData(tx: TransactionData): ReceiptData {
    return {
      invoiceNumber: tx.invoiceNumber,
      storeName: tenant?.name || "Toko",
      storeAddress: tenant?.address,
      storePhone: tenant?.phone,
      receiptNote: tenant?.receiptNote,
      receiptHeader: tenant?.receiptHeader,
      receiptWidth: tenant?.receiptWidth || 80,
      cashierName: tx.cashier.name,
      tableNumber: tx.tableOrder?.table.number ?? null,
      tableArea: tx.tableOrder?.table.area ?? null,
      items: tx.items.map((i) => ({
        name: i.variantLabel ? `${i.productName} (${i.variantLabel})` : i.productName,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        discount: i.discount,
        subtotal: i.subtotal,
        modifiers: i.modifiers?.map((m) => ({
          groupName: m.modifierGroupName,
          optionName: m.modifierOptionName,
          extraPrice: m.extraPrice,
        })),
      })),
      subtotal: tx.subtotal,
      discountAmount: tx.discount,
      serviceChargeAmount: tx.serviceCharge,
      serviceChargePct: tx.serviceChargePct,
      taxAmount: tx.tax,
      taxPct: tx.taxPct,
      total: tx.total,
      amountPaid: tx.amountPaid,
      change: tx.change,
      paymentMethod: tx.paymentMethod,
      note: tx.note,
      createdAt: new Date(tx.createdAt),
    };
  }

  return (
    <>
      <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Riwayat Transaksi</h1>
          <p className="text-gray-500 mt-1 text-sm">{filtered.length} transaksi</p>
        </div>

        {/* Filter Cabang */}
        {outlets.length > 1 && (
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={selectedOutlet}
              onChange={(e) => setSelectedOutlet(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Semua Cabang</option>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Mobile: Card list */}
      <div className="md:hidden space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
            <ShoppingBag className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>Belum ada transaksi</p>
          </div>
        ) : (
          filtered.map((tx) => (
            <div key={tx.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-blue-600 text-sm">{tx.invoiceNumber}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{formatDateTime(tx.createdAt)}</p>
                </div>
                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs flex-shrink-0">
                  {paymentLabel[tx.paymentMethod] || tx.paymentMethod}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                <span>{tx.cashier.name}</span>
                {outlets.length > 1 && tx.outlet && (
                  <>
                    <span>·</span>
                    <span>{tx.outlet.name}</span>
                  </>
                )}
                {tx.customer && (
                  <>
                    <span>·</span>
                    <span>{tx.customer.name}</span>
                  </>
                )}
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">
                    {tx.items.reduce((s, i) => s + i.quantity, 0)} item
                  </span>
                  <ReprintButton data={buildReceiptData(tx)} />
                  {isOwner && tx.status === "COMPLETED" && (
                    <button
                      onClick={() => setRefundTarget(tx)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Retur
                    </button>
                  )}
                  {isOwner && tx.status === "CANCELLED" && (
                    <span className="text-xs text-gray-400 px-2 py-1 bg-gray-50 rounded-lg">
                      Diretur
                    </span>
                  )}
                </div>
                <span className="font-bold text-gray-900 text-sm">{formatCurrency(tx.total)}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop: Table */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">No. Invoice</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Waktu</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Kasir</th>
                {outlets.length > 1 && (
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Cabang</th>
                )}
                <th className="text-left px-4 py-3 font-medium text-gray-600">Pelanggan</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Item</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Pembayaran</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Total</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Struk</th>
                {isOwner && (
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Retur</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={isOwner ? 10 : 9} className="text-center py-12 text-gray-400">
                    <ShoppingBag className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p>Belum ada transaksi</p>
                  </td>
                </tr>
              ) : (
                filtered.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-blue-600">{tx.invoiceNumber}</td>
                    <td className="px-4 py-3 text-gray-500">{formatDateTime(tx.createdAt)}</td>
                    <td className="px-4 py-3 text-gray-700">{tx.cashier.name}</td>
                    {outlets.length > 1 && (
                      <td className="px-4 py-3 text-gray-500">{tx.outlet?.name || "-"}</td>
                    )}
                    <td className="px-4 py-3 text-gray-500">{tx.customer?.name || "-"}</td>
                    <td className="px-4 py-3 text-center text-gray-700">
                      {tx.items.reduce((s, i) => s + i.quantity, 0)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
                        {paymentLabel[tx.paymentMethod] || tx.paymentMethod}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      {formatCurrency(tx.total)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <ReprintButton data={buildReceiptData(tx)} />
                    </td>
                    {isOwner && (
                      <td className="px-4 py-3 text-center">
                        {tx.status === "COMPLETED" ? (
                          <button
                            onClick={() => setRefundTarget(tx)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                            title="Retur transaksi"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Retur
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400 px-2 py-1 bg-gray-50 rounded-lg">
                            {tx.status === "CANCELLED" ? "Diretur" : tx.status}
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    {refundTarget && (
      <RefundModal
        transaction={refundTarget}
        onClose={() => setRefundTarget(null)}
        onSuccess={() => {
          // Mark the transaction as CANCELLED in local state
          setTransactions((prev) =>
            prev.map((tx) =>
              tx.id === refundTarget.id ? { ...tx, status: "CANCELLED" } : tx
            )
          );
          setRefundTarget(null);
        }}
      />
    )}
    </>
  );
}
