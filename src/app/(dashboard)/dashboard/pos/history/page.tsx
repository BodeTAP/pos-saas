import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { ShoppingBag, Clock } from "lucide-react";
import Link from "next/link";
import { ReprintButton } from "@/components/pos/reprint-button";
import type { ReceiptData } from "@/components/pos/receipt";

export default async function ShiftHistoryPage() {
  const session = await auth();
  if (!session?.user.tenantId) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Ambil tenant info untuk struk
  const [tenant, transactions] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: session.user.tenantId },
      select: {
        name: true,
        address: true,
        phone: true,
        receiptWidth: true,
        receiptNote: true,
      },
    }),
    prisma.transaction.findMany({
      where: {
        cashierId: session.user.id,
        tenantId: session.user.tenantId,
        status: "COMPLETED",
        createdAt: { gte: today, lt: tomorrow },
        ...(session.user.outletId && { outletId: session.user.outletId }),
      },
      include: { items: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const totalRevenue = transactions.reduce((sum, tx) => sum + tx.total, 0);
  const totalItems = transactions.reduce(
    (sum, tx) => sum + tx.items.reduce((s, i) => s + i.quantity, 0),
    0
  );

  const paymentLabel: Record<string, string> = {
    CASH: "Tunai",
    QRIS: "QRIS",
    TRANSFER: "Transfer",
    CARD: "Kartu",
    OTHER: "Lainnya",
  };

  // Helper: build receipt data dari transaction
  function buildReceiptData(tx: (typeof transactions)[0]): ReceiptData {
    return {
      invoiceNumber: tx.invoiceNumber,
      storeName: tenant?.name || "Toko",
      storeAddress: tenant?.address,
      storePhone: tenant?.phone,
      receiptNote: tenant?.receiptNote,
      receiptWidth: tenant?.receiptWidth || 80,
      cashierName: session!.user.name,
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
      createdAt: tx.createdAt,
    };
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Riwayat Shift Hari Ini</h1>
          <p className="text-gray-500 mt-1">
            Transaksi yang kamu proses hari ini · {session.user.name}
          </p>
        </div>
        <Link
          href="/dashboard/pos"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
        >
          Kembali ke Kasir
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
              <ShoppingBag className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-sm text-gray-500">Total Transaksi</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{transactions.length}</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center">
              <ShoppingBag className="w-4 h-4 text-green-600" />
            </div>
            <p className="text-sm text-gray-500">Total Pendapatan</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalRevenue)}</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 bg-purple-50 rounded-lg flex items-center justify-center">
              <Clock className="w-4 h-4 text-purple-600" />
            </div>
            <p className="text-sm text-gray-500">Total Item Terjual</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{totalItems}</p>
        </div>
      </div>

      {/* Transaction List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Daftar Transaksi</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">No. Invoice</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Waktu</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Item</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Pembayaran</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Total</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-400">
                    <ShoppingBag className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p>Belum ada transaksi hari ini</p>
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-blue-600">{tx.invoiceNumber}</td>
                    <td className="px-4 py-3 text-gray-500">{formatDateTime(tx.createdAt)}</td>
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
