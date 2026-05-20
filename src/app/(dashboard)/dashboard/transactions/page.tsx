import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { ShoppingBag } from "lucide-react";
import { NoTenant } from "@/components/ui/no-tenant";

export default async function TransactionsPage() {
  const session = await auth();
  if (!session?.user.tenantId) return <NoTenant />;

  const transactions = await prisma.transaction.findMany({
    where: {
      tenantId: session.user.tenantId,
      status: "COMPLETED",
      ...(session.user.outletId && { outletId: session.user.outletId }),
    },
    include: {
      cashier: { select: { name: true } },
      outlet: { select: { name: true } },
      items: true,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const paymentLabel: Record<string, string> = {
    CASH: "Tunai",
    QRIS: "QRIS",
    TRANSFER: "Transfer",
    CARD: "Kartu",
    OTHER: "Lainnya",
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Riwayat Transaksi</h1>
        <p className="text-gray-500 mt-1">{transactions.length} transaksi terakhir</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">No. Invoice</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Waktu</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Kasir</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Item</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Pembayaran</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-400">
                    <ShoppingBag className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p>Belum ada transaksi</p>
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-blue-600">{tx.invoiceNumber}</td>
                    <td className="px-4 py-3 text-gray-500">{formatDateTime(tx.createdAt)}</td>
                    <td className="px-4 py-3 text-gray-700">{tx.cashier.name}</td>
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
