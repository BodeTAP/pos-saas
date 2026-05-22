"use client";

import { useState } from "react";
import { useCartStore } from "@/stores/cart-store";
import { toast } from "@/components/ui/toaster";
import { formatCurrency } from "@/lib/utils";
import { X, Loader2, CheckCircle, Banknote, QrCode, CreditCard, Printer, Download, WifiOff } from "lucide-react";
import { Receipt, type ReceiptData } from "./receipt";
import { printReceipt, downloadReceiptHTML } from "@/lib/print-receipt";
import { enqueueOfflineTransaction } from "@/lib/offline-queue";
import { decrementOfflineStock } from "@/hooks/use-offline-sync";

interface PaymentModalProps {
  total: number;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  taxPct: number;
  cashierId: string;
  cashierName: string;
  tenantId: string;
  tenant: {
    name: string;
    address?: string | null;
    phone?: string | null;
    receiptWidth: number;
    receiptNote: string | null;
    receiptHeader?: string | null;
    activePaymentMethods?: string | null;
  } | null;
  customerId?: string;
  pointsRedeemed?: number;
  cartItems: Array<{ productId: string; quantity: number }>;
  onClose: () => void;
  onSuccess: (soldItems: Array<{ productId: string; quantity: number }>) => void;
}

type PaymentMethod = "CASH" | "QRIS" | "TRANSFER" | "CARD";

interface SavedTransaction {
  invoiceNumber: string;
  subtotal: number;
  discount: number;
  tax: number;
  taxPct: number;
  total: number;
  amountPaid: number;
  change: number;
  paymentMethod: string;
  note: string | null;
  createdAt: string | Date;
  items: Array<{
    productName: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    subtotal: number;
  }>;
}

const ALL_PAYMENT_METHODS = [
  { value: "CASH" as PaymentMethod, label: "Tunai", icon: Banknote },
  { value: "QRIS" as PaymentMethod, label: "QRIS", icon: QrCode },
  { value: "TRANSFER" as PaymentMethod, label: "Transfer", icon: CreditCard },
  { value: "CARD" as PaymentMethod, label: "Kartu", icon: CreditCard },
];

export function PaymentModal({
  total,
  subtotal,
  discountAmount,
  taxAmount,
  taxPct,
  cashierId,
  cashierName,
  tenantId,
  tenant,
  customerId,
  pointsRedeemed,
  cartItems,
  onClose,
  onSuccess,
}: PaymentModalProps) {
  const { items, discountPct, discountNominal, note } = useCartStore();

  // Parse metode pembayaran aktif dari tenant config
  const activeMethods = (() => {
    try {
      const parsed = JSON.parse(tenant?.activePaymentMethods || '["CASH","QRIS","TRANSFER"]') as string[];
      return ALL_PAYMENT_METHODS.filter((m) => parsed.includes(m.value));
    } catch {
      return ALL_PAYMENT_METHODS.slice(0, 3);
    }
  })();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    () => activeMethods[0]?.value || "CASH"
  );
  const [amountPaid, setAmountPaid] = useState<string>(total.toString());
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isOfflineSuccess, setIsOfflineSuccess] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  // Simpan item yang terjual untuk diteruskan ke onSuccess
  const [soldItems] = useState(() =>
    cartItems.map((i) => ({ productId: i.productId, quantity: i.quantity }))
  );

  const paid = parseFloat(amountPaid) || 0;
  const change = Math.max(0, paid - total);

  const quickAmounts = [
    Math.ceil(total / 1000) * 1000,
    Math.ceil(total / 5000) * 5000,
    Math.ceil(total / 10000) * 10000,
    Math.ceil(total / 50000) * 50000,
  ].filter((v, i, arr) => arr.indexOf(v) === i && v >= total).slice(0, 4);

  async function handleConfirm() {
    if (paymentMethod === "CASH" && paid < total) return;

    setIsLoading(true);

    // Helper: proses transaksi sebagai offline queue
    async function processOffline() {
      const config = await import("@/lib/offline-db").then((m) =>
        m.getOfflineDB().tenantConfig.get("current")
      );

      const { localId, invoiceNumber } = await enqueueOfflineTransaction(
        {
          items: items.map((i) => ({
            productId: i.productId,
            productName: i.name,
            productSku: i.sku || null,
            quantity: i.quantity,
            unitPrice: i.price,
            discount: i.discount,
            subtotal: i.subtotal,
          })),
          subtotal,
          discount: discountAmount,
          discountPct: discountNominal > 0 ? 0 : discountPct,
          discountNominal,
          tax: taxAmount,
          taxPct,
          total,
          amountPaid: paid,
          change,
          paymentMethod,
          note: note || null,
          cashierId,
          tenantId,
          customerId: customerId || null,
          pointsRedeemed: pointsRedeemed || 0,
        },
        config?.invoicePrefix || "INV"
      );

      // Kurangi stok di IndexedDB secara optimistic
      await decrementOfflineStock(
        items.map((i) => ({ productId: i.productId, quantity: i.quantity }))
      );

      const offlineReceipt: ReceiptData = {
        invoiceNumber: `${invoiceNumber} (Offline)`,
        storeName: config?.name || tenant?.name || "Toko",
        storeAddress: config?.address || tenant?.address,
        storePhone: config?.phone || tenant?.phone,
        receiptNote: config?.receiptNote || tenant?.receiptNote,
        receiptHeader: config?.receiptHeader || tenant?.receiptHeader,
        receiptWidth: config?.receiptWidth || tenant?.receiptWidth || 80,
        cashierName,
        items: items.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          unitPrice: i.price,
          discount: i.discount,
          subtotal: i.subtotal,
        })),
        subtotal,
        discountAmount,
        taxAmount,
        taxPct,
        total,
        amountPaid: paid,
        change,
        paymentMethod,
        note: note || null,
        createdAt: new Date(),
      };

      setReceiptData(offlineReceipt);
      setIsOfflineSuccess(true);
      setIsSuccess(true);
    }

    try {
      // ── Coba online dulu ──────────────────────────────────────
      let res: Response;
      try {
        res = await fetch("/api/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: items.map((i) => ({
              productId: i.productId,
              productName: i.name,
              productSku: i.sku,
              quantity: i.quantity,
              unitPrice: i.price,
              discount: i.discount,
              subtotal: i.subtotal,
            })),
            subtotal,
            discount: discountAmount,
            discountPct: discountNominal > 0 ? 0 : discountPct,
            discountNominal,
            tax: taxAmount,
            taxPct,
            total,
            amountPaid: paid,
            change,
            paymentMethod,
            note,
            cashierId,
            tenantId,
            customerId: customerId || null,
            pointsRedeemed: pointsRedeemed || 0,
          }),
        });
      } catch {
        // Network error (offline) — fallback ke queue
        await processOffline();
        return;
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Transaksi gagal");
      const savedTransaction = data.transaction as SavedTransaction;

      const receipt: ReceiptData = {
        invoiceNumber: savedTransaction.invoiceNumber,
        storeName: tenant?.name || "Toko",
        storeAddress: tenant?.address,
        storePhone: tenant?.phone,
        receiptNote: tenant?.receiptNote,
        receiptHeader: tenant?.receiptHeader,
        receiptWidth: tenant?.receiptWidth || 80,
        cashierName,
        items: savedTransaction.items.map((i) => ({
          name: i.productName,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          discount: i.discount,
          subtotal: i.subtotal,
        })),
        subtotal: savedTransaction.subtotal,
        discountAmount: savedTransaction.discount,
        taxAmount: savedTransaction.tax,
        taxPct: savedTransaction.taxPct,
        total: savedTransaction.total,
        amountPaid: savedTransaction.amountPaid,
        change: savedTransaction.change,
        paymentMethod: savedTransaction.paymentMethod,
        note: savedTransaction.note,
        createdAt: new Date(savedTransaction.createdAt),
      };

      setReceiptData(receipt);
      setIsSuccess(true);
    } catch (err) {
      console.error(err);
      toast.error("Transaksi gagal. Silakan coba lagi.");
    } finally {
      setIsLoading(false);
    }
  }

  // ── Success Screen ──────────────────────────────────────────
  if (isSuccess && receiptData) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl max-w-sm w-full">
          {/* Header sukses */}
          <div className="p-6 text-center border-b border-gray-100">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3 ${isOfflineSuccess ? "bg-orange-100" : "bg-green-100"}`}>
              {isOfflineSuccess
                ? <WifiOff className="w-7 h-7 text-orange-600" />
                : <CheckCircle className="w-7 h-7 text-green-600" />
              }
            </div>
            <h2 className="text-lg font-bold text-gray-900">
              {isOfflineSuccess ? "Transaksi Tersimpan" : "Pembayaran Berhasil"}
            </h2>
            <p className="text-gray-400 text-sm mt-0.5">{receiptData.invoiceNumber}</p>
            {isOfflineSuccess && (
              <div className="mt-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-xs text-orange-700">
                Transaksi disimpan lokal dan akan dikirim ke server saat internet kembali.
              </div>
            )}
          </div>

          {/* Ringkasan */}
          <div className="px-6 py-4 space-y-2 border-b border-gray-100">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Total</span>
              <span className="font-semibold text-gray-900">{formatCurrency(receiptData.total)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Dibayar</span>
              <span className="font-semibold text-gray-900">{formatCurrency(receiptData.amountPaid)}</span>
            </div>
            {receiptData.change > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Kembalian</span>
                <span className="font-bold text-green-600 text-base">{formatCurrency(receiptData.change)}</span>
              </div>
            )}
          </div>

          {/* Preview struk */}
          <div className="px-6 py-3 border-b border-gray-100">
            <button
              onClick={() => setShowReceipt(!showReceipt)}
              className="text-sm text-blue-600 hover:underline"
            >
              {showReceipt ? "Sembunyikan preview struk" : "Lihat preview struk"}
            </button>
            {showReceipt && (
              <div className="mt-3 border border-gray-200 rounded-lg overflow-auto max-h-64 bg-white p-2 flex justify-center">
                <Receipt data={receiptData} />
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="p-4 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => printReceipt(receiptData)}
                className="flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                <Printer className="w-4 h-4" />
                Print Struk
              </button>
              <button
                onClick={() => downloadReceiptHTML(receiptData)}
                className="flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                <Download className="w-4 h-4" />
                Unduh HTML
              </button>
            </div>
            <button
              onClick={() => onSuccess(soldItems)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl transition-colors"
            >
              Transaksi Baru
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Payment Form ────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Proses Pembayaran</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="bg-blue-50 rounded-xl p-4 text-center">
            <p className="text-sm text-blue-600 mb-1">Total Pembayaran</p>
            <p className="text-3xl font-bold text-blue-700">{formatCurrency(total)}</p>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Metode Pembayaran</p>
            <div className="grid grid-cols-3 gap-2">
              {activeMethods.map((method) => {
                const Icon = method.icon;
                return (
                  <button
                    key={method.value}
                    onClick={() => setPaymentMethod(method.value)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-colors ${
                      paymentMethod === method.value
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs font-medium">{method.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {paymentMethod === "CASH" && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Uang Diterima</p>
              <input
                type="number"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-right text-xl font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-2 mt-2 flex-wrap">
                {quickAmounts.map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setAmountPaid(amount.toString())}
                    className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
                  >
                    {formatCurrency(amount)}
                  </button>
                ))}
              </div>
              {paid >= total && (
                <div className="mt-3 bg-green-50 rounded-xl p-3 flex justify-between items-center">
                  <span className="text-sm text-green-700">Kembalian</span>
                  <span className="text-xl font-bold text-green-700">{formatCurrency(change)}</span>
                </div>
              )}
              {paid > 0 && paid < total && (
                <p className="mt-2 text-sm text-red-500 text-center">
                  Kurang {formatCurrency(total - paid)}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="p-5 border-t border-gray-200">
          <button
            onClick={handleConfirm}
            disabled={isLoading || (paymentMethod === "CASH" && paid < total)}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Memproses...</>
            ) : (
              "Konfirmasi Pembayaran"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
