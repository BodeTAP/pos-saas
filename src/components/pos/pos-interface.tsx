"use client";

import { useState, useCallback } from "react";
import { useCartStore } from "@/stores/cart-store";
import { ProductGrid } from "./product-grid";
import { CartPanel } from "./cart-panel";
import { PaymentModal } from "./payment-modal";
import { HeldTransactionsModal } from "./held-transactions-modal";
import { ShiftModal } from "./shift-modal";
import { Category, Product } from "@prisma/client";
import { saveHeldTransaction, getHeldTransactions } from "@/lib/hold-transactions";
import { PauseCircle, Clock, ShoppingCart, X } from "lucide-react";

type ProductWithCategory = Product & { category: Category | null };

interface POSInterfaceProps {
  products: ProductWithCategory[];
  categories: Category[];
  tenant: {
    taxRate: number;
    currency: string;
    name: string;
    address?: string | null;
    phone?: string | null;
    receiptWidth: number;
    receiptNote: string | null;
    receiptHeader?: string | null;
    invoicePrefix?: string | null;
    pointsPerAmount?: number;
    pointValue?: number;
    activePaymentMethods?: string | null;
  } | null;
  cashierId: string;
  cashierName: string;
  tenantId: string;
  outlet: {
    id: string;
    name: string;
    isMain: boolean;
  } | null;
}

export function POSInterface({
  products,
  categories,
  tenant,
  cashierId,
  cashierName,
  tenantId,
  outlet,
}: POSInterfaceProps) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [showHeld, setShowHeld] = useState(false);
  const [showShift, setShowShift] = useState(false);
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [heldCount, setHeldCount] = useState(() =>
    typeof window !== "undefined" ? getHeldTransactions(cashierId).length : 0
  );

  const cart = useCartStore();
  const taxPct = tenant?.taxRate ?? 0;
  const pointValue = tenant?.pointValue || 100;
  const pointsPerAmount = tenant?.pointsPerAmount || 10000;

  const filteredProducts = products.filter((p) => {
    const matchSearch =
      search === "" ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(search.toLowerCase())) ||
      (p.barcode && p.barcode.includes(search));
    const matchCategory =
      selectedCategory === null || p.categoryId === selectedCategory;
    return matchSearch && matchCategory;
  });

  const handleAddProduct = useCallback(
    (product: ProductWithCategory) => {
      cart.addItem({
        productId: product.id,
        name: product.name,
        sku: product.sku ?? undefined,
        price: product.sellPrice,
        quantity: 1,
        discount: 0,
      });
    },
    [cart]
  );

  // Computed values
  const subtotal = cart.items.reduce((sum, i) => sum + i.subtotal, 0);
  const discountAmount =
    cart.discountNominal > 0
      ? cart.discountNominal
      : subtotal * (cart.discountPct / 100);
  const pointsDiscount = cart.pointsToRedeem * pointValue;
  const afterDiscounts = Math.max(0, subtotal - discountAmount - pointsDiscount);
  const taxAmount = afterDiscounts * (taxPct / 100);
  const total = afterDiscounts + taxAmount;

  function handleHold() {
    if (cart.items.length === 0) return;
    saveHeldTransaction({
      cashierId,
      items: cart.items,
      customer: cart.customer,
      discountPct: cart.discountPct,
      pointsToRedeem: cart.pointsToRedeem,
      note: cart.note,
    });
    cart.clearCart();
    setHeldCount(getHeldTransactions(cashierId).length);
  }

  function handleHeldModalClose() {
    setShowHeld(false);
    setHeldCount(getHeldTransactions(cashierId).length);
  }

  return (
    <div className="flex h-full gap-4 -m-6 p-0 relative">
      {/* Left: Product Grid */}
      <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
        {/* Outlet Indicator */}
        {outlet && (
          <div className="bg-blue-50 border-b border-blue-100 px-4 py-2 flex items-center gap-2 text-xs">
            <span className="text-blue-700 font-medium">Cabang Aktif:</span>
            <span className="text-blue-900 font-semibold">{outlet.name}</span>
            {outlet.isMain && (
              <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
                Utama
              </span>
            )}
          </div>
        )}
        <div className="p-4 bg-white border-b border-gray-200 space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari produk, SKU, atau scan barcode..."
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <button
              onClick={() => setShowHeld(true)}
              className="relative flex items-center gap-2 px-3 py-2.5 border border-gray-300 hover:bg-gray-50 rounded-lg text-sm text-gray-700 transition-colors"
              title="Lihat transaksi tertahan"
            >
              <PauseCircle className="w-4 h-4 text-orange-500" />
              <span className="hidden sm:inline">Tertahan</span>
              {heldCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-orange-500 text-white text-xs px-1.5 py-0 rounded-full font-medium">
                  {heldCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setShowShift(true)}
              className="flex items-center gap-2 px-3 py-2.5 border border-gray-300 hover:bg-gray-50 rounded-lg text-sm text-gray-700 transition-colors"
              title="Manajemen shift"
            >
              <Clock className="w-4 h-4 text-green-500" />
              <span className="hidden sm:inline">Shift</span>
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                selectedCategory === null
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Semua
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === cat.id
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Product grid — add bottom padding on mobile to avoid FAB overlap */}
        <div className="flex-1 overflow-y-auto p-4 pb-24 lg:pb-4">
          <ProductGrid products={filteredProducts} onAddProduct={handleAddProduct} />
        </div>
      </div>

      {/* Desktop: Right Cart Panel */}
      <div className="hidden lg:flex w-80 xl:w-96 bg-white border-l border-gray-200 flex-col">
        <CartPanel
          taxPct={taxPct}
          subtotal={subtotal}
          discountAmount={discountAmount}
          pointsDiscount={pointsDiscount}
          taxAmount={taxAmount}
          total={total}
          pointValue={tenant?.pointValue || 100}
          onCheckout={() => setShowPayment(true)}
          onHold={handleHold}
        />
      </div>

      {/* Mobile: Floating Cart Button */}
      <button
        onClick={() => setShowMobileCart(true)}
        className="lg:hidden fixed bottom-5 right-5 z-30 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-2xl shadow-lg font-medium text-sm transition-colors"
      >
        <ShoppingCart className="w-5 h-5" />
        <span>Keranjang</span>
        {cart.items.length > 0 && (
          <span className="bg-white text-blue-600 text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
            {cart.items.reduce((s, i) => s + i.quantity, 0)}
          </span>
        )}
      </button>

      {/* Mobile: Cart Bottom Sheet */}
      {showMobileCart && (
        <>
          <div
            className="lg:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => setShowMobileCart(false)}
          />
          <div className="lg:hidden fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0">
              <h2 className="font-semibold text-gray-900">Keranjang Belanja</h2>
              <button
                onClick={() => setShowMobileCart(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden flex flex-col">
              <CartPanel
                taxPct={taxPct}
                subtotal={subtotal}
                discountAmount={discountAmount}
                pointsDiscount={pointsDiscount}
                taxAmount={taxAmount}
                total={total}
                pointValue={tenant?.pointValue || 100}
                onCheckout={() => { setShowMobileCart(false); setShowPayment(true); }}
                onHold={() => { handleHold(); setShowMobileCart(false); }}
              />
            </div>
          </div>
        </>
      )}

      {/* Modals */}
      {showPayment && (
        <PaymentModal
          total={total}
          subtotal={subtotal}
          discountAmount={discountAmount + pointsDiscount}
          taxAmount={taxAmount}
          taxPct={taxPct}
          cashierId={cashierId}
          cashierName={cashierName}
          tenantId={tenantId}
          tenant={tenant}
          customerId={cart.customer?.id}
          pointsRedeemed={cart.pointsToRedeem}
          onClose={() => setShowPayment(false)}
          onSuccess={() => {
            cart.clearCart();
            setShowPayment(false);
          }}
        />
      )}

      {showHeld && (
        <HeldTransactionsModal
          cashierId={cashierId}
          onClose={handleHeldModalClose}
        />
      )}

      {showShift && (
        <ShiftModal
          onClose={() => setShowShift(false)}
          onShiftChange={() => setShowShift(false)}
        />
      )}
    </div>
  );
}
