"use client";

import { forwardRef } from "react";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export interface ReceiptData {
  invoiceNumber: string;
  storeName: string;
  storeAddress?: string | null;
  storePhone?: string | null;
  receiptNote?: string | null;
  receiptHeader?: string | null;
  receiptWidth: number; // 58 atau 80 mm
  cashierName: string;
  tableNumber?: string | null; // F&B: nomor meja
  tableArea?: string | null;   // F&B: area meja
  items: {
    name: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    subtotal: number;
    modifiers?: Array<{ groupName: string; optionName: string; extraPrice: number }>;
  }[];
  subtotal: number;
  discountAmount: number;
  serviceChargeAmount?: number;
  serviceChargePct?: number;
  taxAmount: number;
  taxPct: number;
  total: number;
  amountPaid: number;
  change: number;
  paymentMethod: string;
  note?: string | null;
  createdAt: Date;
}

const paymentLabel: Record<string, string> = {
  CASH: "Tunai",
  QRIS: "QRIS",
  TRANSFER: "Transfer Bank",
  CARD: "Kartu",
  OTHER: "Lainnya",
};

// Komponen Receipt — di-render sebagai HTML untuk print
export const Receipt = forwardRef<HTMLDivElement, { data: ReceiptData }>(
  ({ data }, ref) => {
    const is58mm = data.receiptWidth === 58;
    const lineWidth = is58mm ? 32 : 48; // karakter per baris

    function divider() {
      return "-".repeat(lineWidth);
    }

    return (
      <div
        ref={ref}
        className="receipt-print font-mono text-black bg-white"
        style={{
          width: is58mm ? "58mm" : "80mm",
          padding: "4mm",
          fontSize: is58mm ? "10px" : "11px",
          lineHeight: "1.4",
        }}
      >
        {/* Header Toko */}
        <div className="text-center mb-2">
          <p className="font-bold text-sm uppercase">{data.storeName}</p>
          {data.receiptHeader && (
            <p className="text-xs italic">{data.receiptHeader}</p>
          )}
          {data.storeAddress && (
            <p className="text-xs">{data.storeAddress}</p>
          )}
          {data.storePhone && (
            <p className="text-xs">Telp: {data.storePhone}</p>
          )}
        </div>

        <p className="text-center text-xs">{divider()}</p>

        {/* Info Transaksi */}
        <div className="text-xs my-1 space-y-0.5">
          <div className="flex justify-between">
            <span>No.</span>
            <span className="font-semibold">{data.invoiceNumber}</span>
          </div>
          <div className="flex justify-between">
            <span>Tanggal</span>
            <span>{formatDateTime(data.createdAt)}</span>
          </div>
          <div className="flex justify-between">
            <span>Kasir</span>
            <span>{data.cashierName}</span>
          </div>
          {/* F&B: info meja */}
          {data.tableNumber && (
            <div className="flex justify-between">
              <span>Meja</span>
              <span>
                #{data.tableNumber}
                {data.tableArea ? ` (${data.tableArea})` : ""}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Pembayaran</span>
            <span>{paymentLabel[data.paymentMethod] || data.paymentMethod}</span>
          </div>
        </div>

        <p className="text-center text-xs">{divider()}</p>

        {/* Item List */}
        <div className="my-1 space-y-1">
          {data.items.map((item, i) => (
            <div key={i} className="text-xs">
              <p className="font-medium truncate">{item.name}</p>
              <div className="flex justify-between pl-2">
                <span>
                  {item.quantity} x {formatCurrency(item.unitPrice)}
                  {item.discount > 0 && (
                    <span className="text-gray-500"> (-{formatCurrency(item.discount)})</span>
                  )}
                </span>
                <span className="font-medium">{formatCurrency(item.subtotal)}</span>
              </div>
              {/* Modifier add-ons */}
              {item.modifiers && item.modifiers.length > 0 && (
                <div className="pl-2 text-gray-500 space-y-0.5">
                  {item.modifiers.map((mod, mi) => (
                    <div key={mi} className="flex justify-between">
                      <span>+ {mod.optionName}</span>
                      {mod.extraPrice > 0 && (
                        <span>+{formatCurrency(mod.extraPrice)}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <p className="text-center text-xs">{divider()}</p>

        {/* Totals */}
        <div className="text-xs my-1 space-y-0.5">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatCurrency(data.subtotal)}</span>
          </div>
          {data.discountAmount > 0 && (
            <div className="flex justify-between">
              <span>Diskon</span>
              <span>- {formatCurrency(data.discountAmount)}</span>
            </div>
          )}
          {/* Service charge */}
          {(data.serviceChargeAmount ?? 0) > 0 && (
            <div className="flex justify-between">
              <span>Service Charge ({data.serviceChargePct ?? 0}%)</span>
              <span>{formatCurrency(data.serviceChargeAmount!)}</span>
            </div>
          )}
          {data.taxPct > 0 && (
            <div className="flex justify-between">
              <span>PPN ({data.taxPct}%)</span>
              <span>{formatCurrency(data.taxAmount)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-sm border-t border-dashed border-gray-400 pt-1 mt-1">
            <span>TOTAL</span>
            <span>{formatCurrency(data.total)}</span>
          </div>
          <div className="flex justify-between">
            <span>Bayar</span>
            <span>{formatCurrency(data.amountPaid)}</span>
          </div>
          {data.change > 0 && (
            <div className="flex justify-between font-semibold">
              <span>Kembali</span>
              <span>{formatCurrency(data.change)}</span>
            </div>
          )}
        </div>

        {/* Catatan */}
        {data.note && (
          <>
            <p className="text-center text-xs">{divider()}</p>
            <p className="text-xs text-center my-1 italic">{data.note}</p>
          </>
        )}

        <p className="text-center text-xs">{divider()}</p>

        {/* Footer */}
        <div className="text-center text-xs mt-1">
          <p>{data.receiptNote || "Terima kasih telah berbelanja!"}</p>
          <p className="mt-1 text-gray-400">* Struk ini adalah bukti pembayaran sah *</p>
        </div>
      </div>
    );
  }
);

Receipt.displayName = "Receipt";

// ─────────────────────────────────────────────
// KITCHEN RECEIPT — struk dapur (tanpa harga)
// ─────────────────────────────────────────────
// Render helper untuk struk dapur — dipakai via window.open + print
// (component React-nya tidak ada karena selalu di-render sebagai HTML string)

export interface KitchenReceiptData {
  invoiceNumber: string;
  tableNumber?: string | null;
  tableArea?: string | null;
  cashierName?: string | null;
  note?: string | null;
  createdAt: Date;
  items: Array<{
    name: string;
    quantity: number;
    modifiers?: Array<{ groupName: string; optionName: string }>;
    note?: string | null;
  }>;
}
