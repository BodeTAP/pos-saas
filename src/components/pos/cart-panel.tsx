"use client";

import { useCartStore, POINT_VALUE, getCartItemKey } from "@/stores/cart-store";
import { formatCurrency } from "@/lib/utils";
import { Trash2, Plus, Minus, ShoppingCart, Star, PauseCircle, AlertTriangle, ChefHat, Loader2 } from "lucide-react";
import { CustomerSelector } from "./customer-selector";

interface CartPanelProps {
  taxPct: number;
  subtotal: number;
  discountAmount: number;
  pointsDiscount: number;
  taxAmount: number;
  serviceChargeAmount?: number;
  serviceChargePct?: number;
  total: number;
  pointValue?: number;
  onCheckout: () => void;
  onHold: () => void;
  // F&B
  isFnB?: boolean;
  hasTable?: boolean;
  onSendToKitchen?: () => void;
  isSendingToKitchen?: boolean;
}

export function CartPanel({
  taxPct,
  subtotal,
  discountAmount,
  pointsDiscount,
  taxAmount,
  serviceChargeAmount = 0,
  serviceChargePct = 0,
  total,
  pointValue = POINT_VALUE,
  onCheckout,
  onHold,
  isFnB = false,
  hasTable = false,
  onSendToKitchen,
  isSendingToKitchen = false,
}: CartPanelProps) {
  const {
    items,
    updateQuantity,
    removeItem,
    discountPct,
    setDiscountPct,
    note,
    setNote,
    customer,
    pointsToRedeem,
    setPointsToRedeem,
    updateItemDiscount,
  } = useCartStore();

  // Maksimal poin yang bisa dipakai = min(saldo, total before points)
  const maxRedeemable = customer
    ? Math.min(
        customer.points,
        Math.floor((subtotal - discountAmount) / pointValue)
      )
    : 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-blue-600" />
          <h2 className="font-semibold text-gray-900">Keranjang</h2>
          {items.length > 0 && (
            <span className="ml-auto bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
              {items.reduce((s, i) => s + i.quantity, 0)} item
            </span>
          )}
        </div>
      </div>

      {/* Customer */}
      <div className="p-3 border-b border-gray-100">
        <CustomerSelector />
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-400">
            <ShoppingCart className="w-10 h-10 mb-2 opacity-20" />
            <p className="text-sm">Keranjang kosong</p>
            <p className="text-xs mt-1">Klik produk untuk menambahkan</p>
          </div>
        ) : (
          items.map((item) => {
            const stockAvailable = item.stock ?? Infinity;
            const isOverStock = item.quantity > stockAvailable;
            const isLowStock =
              item.stock !== undefined &&
              item.stock <= (item.minStock ?? 5) &&
              item.stock > 0;

            return (
              <div
                key={getCartItemKey(item)}
                className={`rounded-lg p-3 border ${
                  isOverStock
                    ? "bg-red-50 border-red-200"
                    : isLowStock
                    ? "bg-orange-50 border-orange-200"
                    : "bg-gray-50 border-gray-100"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {item.name}
                    </p>
                    {item.variantLabel && (
                      <p className="text-xs text-blue-600 font-medium mt-0.5">
                        {item.variantLabel}
                      </p>
                    )}
                    {/* F&B: tampilkan modifier */}
                    {item.modifiers && item.modifiers.length > 0 && (
                      <div className="text-xs text-gray-500 mt-0.5 space-y-0.5">
                        {item.modifiers.map((m, i) => (
                          <p key={i}>
                            + {m.optionName}
                            {m.extraPrice > 0 && (
                              <span className="text-gray-400"> (+{formatCurrency(m.extraPrice)})</span>
                            )}
                          </p>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-gray-500">
                      {formatCurrency(item.price)} / pcs
                    </p>
                  </div>
                  <button
                    onClick={() => removeItem(item.productId, item.variantSkuId, item.modifiers)}
                    className="text-red-400 hover:text-red-600 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity - 1, item.variantSkuId, item.modifiers)}
                      className="w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-sm font-medium w-6 text-center">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity + 1, item.variantSkuId, item.modifiers)}
                      className="w-6 h-6 rounded-full bg-blue-100 hover:bg-blue-200 flex items-center justify-center"
                    >
                      <Plus className="w-3 h-3 text-blue-600" />
                    </button>
                  </div>
                  <p className="text-sm font-bold text-gray-900">
                    {formatCurrency(item.subtotal)}
                  </p>
                </div>

                {/* Stock warnings */}
                {isOverStock && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-red-700 bg-red-100 rounded px-2 py-1">
                    <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                    <span>Melebihi stok tersedia ({stockAvailable} tersisa)</span>
                  </div>
                )}
                {!isOverStock && isLowStock && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-orange-700 bg-orange-100 rounded px-2 py-1">
                    <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                    <span>Stok menipis ({item.stock} tersisa)</span>
                  </div>
                )}

                {/* Per-item discount */}
                <div className="mt-2 flex items-center gap-2">
                  <label className="text-xs text-gray-400 flex-shrink-0">Diskon item</label>
                  <input
                    type="number"
                    min={0}
                    max={item.price * item.quantity}
                    value={item.discount || ""}
                    onChange={(e) => {
                      const val = Math.min(
                        parseFloat(e.target.value) || 0,
                        item.price * item.quantity
                      );
                      updateItemDiscount(item.productId, val, item.variantSkuId, item.modifiers);
                    }}
                    placeholder="0"
                    className="flex-1 px-2 py-0.5 border border-gray-200 rounded text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Summary */}
      <div className="border-t border-gray-200 p-4 space-y-3">
        {/* Diskon */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 w-20">Diskon (%)</label>
          <input
            type="number"
            min={0}
            max={100}
            value={discountPct || ""}
            onChange={(e) => setDiscountPct(Number(e.target.value))}
            placeholder="0"
            className="flex-1 px-2 py-1 border border-gray-200 rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Tukar Poin */}
        {customer && customer.points > 0 && maxRedeemable > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs text-amber-800">
              <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
              <span className="font-medium">Tukar Poin</span>
              <span className="text-amber-600">
                ({customer.points} tersedia · 1 poin = {formatCurrency(pointValue)})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={maxRedeemable}
                value={pointsToRedeem || ""}
                onChange={(e) =>
                  setPointsToRedeem(Math.min(maxRedeemable, Number(e.target.value)))
                }
                placeholder="0"
                className="flex-1 px-2 py-1 border border-amber-300 rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
              <button
                onClick={() => setPointsToRedeem(maxRedeemable)}
                className="text-xs text-amber-700 hover:text-amber-900 font-medium"
              >
                Max
              </button>
            </div>
          </div>
        )}

        <div>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Catatan transaksi..."
            className="w-full px-3 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Diskon</span>
              <span>- {formatCurrency(discountAmount)}</span>
            </div>
          )}
          {pointsDiscount > 0 && (
            <div className="flex justify-between text-amber-600">
              <span>Tukar Poin ({pointsToRedeem} poin)</span>
              <span>- {formatCurrency(pointsDiscount)}</span>
            </div>
          )}
          {serviceChargePct > 0 && (
            <div className="flex justify-between text-gray-600">
              <span>Service Charge ({serviceChargePct}%)</span>
              <span>{formatCurrency(serviceChargeAmount)}</span>
            </div>
          )}
          {taxPct > 0 && (
            <div className="flex justify-between text-gray-600">
              <span>PPN ({taxPct}%)</span>
              <span>{formatCurrency(taxAmount)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-gray-900 text-base pt-2 border-t border-gray-200">
            <span>Total</span>
            <span className="text-blue-600">{formatCurrency(total)}</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={onHold}
            disabled={items.length === 0}
            className="col-span-1 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-300 text-gray-700 font-medium py-3 rounded-xl text-xs flex items-center justify-center gap-1 transition-colors"
            title="Tahan transaksi"
          >
            <PauseCircle className="w-3.5 h-3.5" />
            Tahan
          </button>
          <button
            onClick={onCheckout}
            disabled={items.length === 0}
            className="col-span-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl text-sm transition-colors"
          >
            Bayar
          </button>
        </div>

        {/* F&B: Kirim ke Dapur */}
        {isFnB && hasTable && onSendToKitchen && (
          <button
            onClick={onSendToKitchen}
            disabled={items.length === 0 || isSendingToKitchen}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
          >
            {isSendingToKitchen ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Mengirim...</>
            ) : (
              <><ChefHat className="w-4 h-4" /> Kirim ke Dapur</>
            )}
          </button>
        )}
        {isFnB && !hasTable && items.length > 0 && (
          <p className="text-xs text-center text-amber-600">
            Pilih meja terlebih dahulu untuk kirim ke dapur
          </p>
        )}
      </div>
    </div>
  );
}
