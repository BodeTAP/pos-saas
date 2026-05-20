"use client";

import { useEffect, useState } from "react";
import { useCartStore } from "@/stores/cart-store";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { X, PauseCircle, Trash2, ShoppingCart } from "lucide-react";
import {
  getHeldTransactions,
  removeHeldTransaction,
  type HeldTransaction,
} from "@/lib/hold-transactions";

interface HeldTransactionsModalProps {
  cashierId: string;
  onClose: () => void;
}

export function HeldTransactionsModal({ cashierId, onClose }: HeldTransactionsModalProps) {
  const { loadHeld } = useCartStore();
  const [held, setHeld] = useState<HeldTransaction[]>([]);

  useEffect(() => {
    setHeld(getHeldTransactions(cashierId));
  }, [cashierId]);

  function handleRestore(tx: HeldTransaction) {
    loadHeld({
      items: tx.items,
      customer: tx.customer,
      discountPct: tx.discountPct,
      pointsToRedeem: tx.pointsToRedeem,
      note: tx.note,
    });
    removeHeldTransaction(tx.id);
    onClose();
  }

  function handleDelete(id: string) {
    if (!confirm("Hapus transaksi tertahan ini?")) return;
    removeHeldTransaction(id);
    setHeld(getHeldTransactions(cashierId));
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <PauseCircle className="w-5 h-5 text-orange-500" />
            <h2 className="text-lg font-semibold text-gray-900">Transaksi Tertahan</h2>
            <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">
              {held.length}
            </span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {held.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400">
              <PauseCircle className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">Belum ada transaksi tertahan</p>
            </div>
          ) : (
            <div className="space-y-2">
              {held.map((tx) => {
                const subtotal = tx.items.reduce((s, i) => s + i.subtotal, 0);
                const itemCount = tx.items.reduce((s, i) => s + i.quantity, 0);
                return (
                  <div
                    key={tx.id}
                    className="bg-gray-50 border border-gray-100 rounded-lg p-3"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-500">
                          {formatDateTime(new Date(tx.heldAt))}
                        </p>
                        {tx.customer && (
                          <p className="text-sm font-medium text-gray-900 mt-0.5 truncate">
                            👤 {tx.customer.name}
                          </p>
                        )}
                        {tx.note && (
                          <p className="text-xs text-gray-500 italic mt-0.5 truncate">
                            &ldquo;{tx.note}&rdquo;
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDelete(tx.id)}
                        className="text-red-400 hover:text-red-600 p-1 flex-shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="text-xs text-gray-600 mb-2 space-y-0.5">
                      {tx.items.slice(0, 3).map((i) => (
                        <div key={i.productId} className="flex justify-between">
                          <span className="truncate">
                            {i.quantity}x {i.name}
                          </span>
                          <span className="ml-2 flex-shrink-0">{formatCurrency(i.subtotal)}</span>
                        </div>
                      ))}
                      {tx.items.length > 3 && (
                        <p className="text-gray-400 italic">
                          + {tx.items.length - 3} item lainnya
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between border-t border-gray-200 pt-2">
                      <div>
                        <p className="text-xs text-gray-500">{itemCount} item</p>
                        <p className="text-sm font-bold text-gray-900">
                          {formatCurrency(subtotal)}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRestore(tx)}
                        className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                        Lanjutkan
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
