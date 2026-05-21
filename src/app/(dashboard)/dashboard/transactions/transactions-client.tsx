"use client";

import { useState } from "react";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { ShoppingBag, Filter } from "lucide-react";
import { ReprintButton } from "@/components/pos/reprint-button";
import type { ReceiptData } from "@/components/pos/receipt";

interface TransactionItem {
  id: string;
  productName: string;
  productSku: string | null;
  quantity: number;
  unitPrice: number;
  discount: number;
  subtotal: number;
}

interface TransactionData {
  id: string;
  invoiceNumber: string;
  paymentMethod: string;
  subtotal: number;
  discount: number;
  discountPct: number;
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
}

interface TransactionsClientProps {
  initialTransactions: TransactionData[];
  outlets: OutletSummary[];
  tenant: TenantInfo | null;
  cashierName: string;
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
  cashierName,
}: TransactionsClientProps) {
  const [selectedOutlet, setSelectedOutlet] = useState<string>("ALL");

  const filtered =
    selectedOutlet === "ALL"
      ? initialTransactions
      : initialTransactions.filter((tx) => tx.outlet?.id === selectedOutlet);

  function buildReceiptData(tx: TransactionData): ReceiptData {
    return {
      invoiceNumber: tx.invoiceNumber,
      storeName: tenant?.name || "Toko",
      storeAddress: tenant?.address,
      storePhone: tenant?.phone,
      receiptNote: tenant?.receiptNote,
      receiptWidth: tenant?.receiptWidth || 80,
      cashierName: tx.cashier.name,
      items: tx.items.map((i) => ({
        name: i.productName,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        discount: i.discount,
        subtotal: i.subtotal,
      })),
      subtotal: tx.subtotal,
      discountAmount: tx.discount,
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
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Riwayat Transaksi</h1>
          <p className="text-gray-500 mt-1">{filtered.length} transaksi</p>
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

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
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
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-gray-400">
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
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
