"use client";

import { useState, useCallback, useEffect } from "react";
import { useCartStore } from "@/stores/cart-store";
import { ProductGrid } from "./product-grid";
import { CartPanel } from "./cart-panel";
import { PaymentModal } from "./payment-modal";
import { HeldTransactionsModal } from "./held-transactions-modal";
import { ShiftModal } from "./shift-modal";
import { Category, Product } from "@prisma/client";
import { saveHeldTransaction, getHeldTransactions } from "@/lib/hold-transactions";
import { PauseCircle, Clock, ShoppingCart, X } from "lucide-react";import { useOfflineSync } from "@/hooks/use-offline-sync";
import { useOfflinePinSync } from "@/hooks/use-offline-pin-sync";
import { OfflineBanner, OfflineIndicator, StaleBanner } from "@/components/pwa/offline-indicator";
import { OfflineSyncStatus } from "@/components/pwa/offline-sync-status";
import { OfflinePinModal } from "@/components/pwa/offline-pin-modal";
import { getActiveOfflineSession, hasValidOfflinePin } from "@/lib/offline-pin";
import { VariantPickerModal, type ProductForVariant } from "./variant-picker-modal";
import { TableStatus } from "@prisma/client";

type ProductWithCategory = Product & {
  category: Category | null;
  hasVariants?: boolean;
  variantTypes?: Array<{
    id: string;
    name: string;
    position: number;
    options: Array<{ id: string; name: string }>;
  }>;
  variantSKUs?: Array<{
    id: string;
    sku: string | null;
    price: number;
    buyPrice: number;
    imageUrl: string | null;
    isActive: boolean;
    stock: number;
    minStock: number;
    label: string;
    optionIds: string[];
  }>;
};

export interface TableInfo {
  id: string;
  number: string;
  name: string | null;
  capacity: number;
  area: string | null;
  status: TableStatus;
  activeOrderId: string | null;
}

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
    pointsPerAmount?: number;
    pointValue?: number;
    activePaymentMethods?: string | null;
    invoicePrefix?: string | null;
  } | null;
  cashierId: string;
  cashierName: string;
  cashierRole: string;
  tenantId: string;
  outlet: {
    id: string;
    name: string;
    isMain: boolean;
  } | null;
  businessType?: string;
  tables?: TableInfo[];
}

export function POSInterface({
  products: initialProducts,
  categories,
  tenant,
  cashierId,
  cashierName,
  cashierRole,
  tenantId,
  outlet,
  businessType = "RETAIL",
  tables: initialTables = [],
}: POSInterfaceProps) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [showHeld, setShowHeld] = useState(false);
  const [showShift, setShowShift] = useState(false);
  const [showMobileCart, setShowMobileCart] = useState(false);

  // F&B: state meja
  const isFnB = businessType === "FNB";
  const [tables, setTables] = useState<TableInfo[]>(initialTables);
  const [selectedTable, setSelectedTable] = useState<TableInfo | null>(null);
  const [showTableSelector, setShowTableSelector] = useState(false);
  const [heldCount, setHeldCount] = useState(() =>
    typeof window !== "undefined" ? getHeldTransactions(cashierId).length : 0
  );

  // State produk lokal — bisa diupdate setelah transaksi tanpa full page refresh
  const [products, setProducts] = useState<ProductWithCategory[]>(initialProducts);

  // Saat offline, hydrate produk dari IndexedDB agar stoknya akurat
  // (tidak terikat ke HTML cache lama dari service worker)
  useEffect(() => {
    if (typeof window === "undefined") return;

    async function loadOfflineProducts() {
      if (navigator.onLine) return; // Online — pakai data dari server

      try {
        const { getOfflineProducts } = await import("@/hooks/use-offline-sync");
        const offlineProducts = await getOfflineProducts();
        if (offlineProducts.length === 0) return;

        // Map OfflineProduct ke ProductWithCategory format
        const mapped: ProductWithCategory[] = offlineProducts.map((p) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          barcode: p.barcode,
          description: null,
          imageUrl: p.imageUrl,
          buyPrice: 0,
          sellPrice: p.sellPrice,
          stock: p.stock,
          minStock: p.minStock,
          unit: p.unit,
          isActive: p.isActive,
          tenantId,
          categoryId: p.categoryId,
          hasVariants: p.hasVariants,
          createdAt: new Date(),
          updatedAt: new Date(),
          category: p.categoryName
            ? {
                id: p.categoryId ?? "",
                name: p.categoryName,
                tenantId,
                createdAt: new Date(),
                updatedAt: new Date(),
              }
            : null,
          variantTypes: p.variantTypes,
          variantSKUs: p.variantSKUs,
        }));

        setProducts(mapped);
      } catch (err) {
        console.warn("Failed to load offline products:", err);
      }
    }

    // Trigger saat offline
    if (!navigator.onLine) {
      loadOfflineProducts();
    }

    // Trigger saat user kehilangan koneksi
    const handleOffline = () => loadOfflineProducts();
    window.addEventListener("offline", handleOffline);
    return () => window.removeEventListener("offline", handleOffline);
  }, [tenantId]);

  // State untuk variant picker
  const [variantProduct, setVariantProduct] = useState<ProductForVariant | null>(null);

  // State PIN offline — true jika kasir butuh input PIN untuk mode offline
  const [needsOfflinePin, setNeedsOfflinePin] = useState(false);

  // Cek apakah perlu PIN modal saat offline
  useEffect(() => {
    async function checkOfflineSession() {
      // Hanya cek saat offline
      if (typeof window === "undefined" || navigator.onLine) {
        setNeedsOfflinePin(false);
        return;
      }

      // Cek apakah user punya PIN offline yang valid
      const hasPin = await hasValidOfflinePin(cashierId);
      if (!hasPin) {
        // Belum punya PIN — tetap biarkan akses (graceful, biar user bisa lihat data cache)
        // Modal hanya muncul kalau user sudah set PIN tapi sesi expired
        setNeedsOfflinePin(false);
        return;
      }

      // Cek session offline aktif
      const session = await getActiveOfflineSession();
      setNeedsOfflinePin(!session);
    }

    checkOfflineSession();

    // Re-check saat status koneksi berubah
    const handleOnline = () => setNeedsOfflinePin(false);
    const handleOffline = () => checkOfflineSession();
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [cashierId]);

  // Sync data ke IndexedDB saat online (untuk offline support)
  const { sync: forceSync } = useOfflineSync({
    onSynced: () => {
      // Setelah sync, refresh produk dari server jika online
      // (produk di state sudah up-to-date dari server render)
    },
  });

  // Sync PIN offline ke IndexedDB (hanya untuk KASIR)
  useOfflinePinSync(cashierId, cashierRole);

  const cart = useCartStore();
  const taxPct = tenant?.taxRate ?? 0;
  const pointValue = tenant?.pointValue || 100;

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
      // Produk dengan varian → buka picker dulu
      if (product.hasVariants && product.variantSKUs && product.variantSKUs.length > 0) {
        setVariantProduct({
          id: product.id,
          name: product.name,
          imageUrl: product.imageUrl ?? null,
          sellPrice: product.sellPrice,
          variantTypes: product.variantTypes ?? [],
          variantSKUs: product.variantSKUs,
        });
        return;
      }
      // Produk biasa → langsung tambah ke keranjang
      cart.addItem({
        productId: product.id,
        name: product.name,
        sku: product.sku ?? undefined,
        price: product.sellPrice,
        quantity: 1,
        discount: 0,
        stock: product.stock,
        minStock: product.minStock,
      });
    },
    [cart]
  );

  const handleVariantConfirm = useCallback(
    (params: {
      productId: string;
      variantSkuId: string;
      variantLabel: string;
      price: number;
      stock: number;
      minStock: number;
      sku: string | null;
    }) => {
      const product = products.find((p) => p.id === params.productId);
      if (!product) return;
      cart.addItem({
        productId: params.productId,
        variantSkuId: params.variantSkuId,
        variantLabel: params.variantLabel,
        name: `${product.name}`,
        sku: params.sku ?? undefined,
        price: params.price,
        quantity: 1,
        discount: 0,
        stock: params.stock,
        minStock: params.minStock,
      });
      setVariantProduct(null);
    },
    [cart, products]
  );

  /**
   * Kurangi stok produk di state lokal setelah transaksi berhasil.
   * Dipanggil dari PaymentModal dengan daftar item yang terjual.
   */
  const handleTransactionSuccess = useCallback(
    (soldItems: Array<{ productId: string; quantity: number; variantSkuId?: string | null }>) => {
      setProducts((prev) =>
        prev.map((p) => {
          // Update stok produk biasa
          const sold = soldItems.find((i) => i.productId === p.id && !i.variantSkuId);
          if (sold) {
            const newStock = Math.max(0, p.stock - sold.quantity);
            return { ...p, stock: newStock };
          }
          // Update stok varian
          if (p.hasVariants && p.variantSKUs) {
            const variantSoldItems = soldItems.filter(
              (i) => i.productId === p.id && i.variantSkuId
            );
            if (variantSoldItems.length === 0) return p;
            const updatedSKUs = p.variantSKUs.map((sku) => {
              const soldVariant = variantSoldItems.find((i) => i.variantSkuId === sku.id);
              if (!soldVariant) return sku;
              return { ...sku, stock: Math.max(0, sku.stock - soldVariant.quantity) };
            });
            return { ...p, variantSKUs: updatedSKUs };
          }
          return p;
        })
      );
      cart.clearCart();
      setShowPayment(false);
      // F&B: reset meja setelah transaksi selesai
      if (selectedTable) {
        setSelectedTable(null);
        // Update status meja di local state
        setTables((prev) =>
          prev.map((t) =>
            t.id === selectedTable.id
              ? { ...t, status: "EMPTY" as const, activeOrderId: null }
              : t
          )
        );
      }
    },
    [cart, selectedTable]
  );

  // Computed values
  const subtotal = cart.items.reduce((sum, i) => sum + i.subtotal, 0);
  const discountAmount =
    cart.discountNominal > 0
      ? cart.discountNominal
      : subtotal * (cart.discountPct / 100);
  const pointsDiscount = cart.pointsToRedeem * pointValue;
  const afterDiscounts = Math.max(0, subtotal - discountAmount - pointsDiscount);
  // F&B: service charge dari tenant config
  const serviceChargePct = (tenant as { serviceChargePct?: number } | null)?.serviceChargePct ?? 0;
  const serviceChargeAmount = afterDiscounts * (serviceChargePct / 100);
  const taxAmount = (afterDiscounts + serviceChargeAmount) * (taxPct / 100);
  const total = afterDiscounts + serviceChargeAmount + taxAmount;

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
        {/* Offline Banner */}
        <OfflineBanner />
        {/* Stale data banner */}
        <StaleBanner onSyncRequest={forceSync} />

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
            {/* F&B: Pilih Meja */}
            {isFnB && (
              <button
                onClick={() => setShowTableSelector(true)}
                className={`flex items-center gap-2 px-3 py-2.5 border rounded-lg text-sm font-medium transition-colors ${
                  selectedTable
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-300 hover:bg-gray-50 text-gray-700"
                }`}
                title="Pilih meja"
              >
                <span className="text-base">🍽️</span>
                <span className="hidden sm:inline">
                  {selectedTable ? `Meja ${selectedTable.number}` : "Pilih Meja"}
                </span>
              </button>
            )}
            {/* Offline queue status */}
            <OfflineSyncStatus />
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

        {/* Product grid */}
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
          serviceChargePct={serviceChargePct}
          serviceChargeAmount={serviceChargeAmount}
          tableOrderId={selectedTable?.activeOrderId ?? null}
          cashierId={cashierId}
          cashierName={cashierName}
          tenantId={tenantId}
          tenant={tenant}
          customerId={cart.customer?.id}
          pointsRedeemed={cart.pointsToRedeem}
          cartItems={cart.items}
          onClose={() => setShowPayment(false)}
          onSuccess={handleTransactionSuccess}        />
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

      {/* Variant Picker Modal */}
      {variantProduct && (
        <VariantPickerModal
          product={variantProduct}
          onClose={() => setVariantProduct(null)}
          onConfirm={handleVariantConfirm}
        />
      )}

      {/* PIN Offline Modal — muncul saat offline & sesi expired */}
      {needsOfflinePin && outlet && (
        <OfflinePinModal
          userId={cashierId}
          cashierId={cashierId}
          outletId={outlet.id}
          onSuccess={() => setNeedsOfflinePin(false)}
        />
      )}

      {/* Offline status indicator */}
      <OfflineIndicator onSyncRequest={forceSync} />

      {/* F&B: Table Selector Modal */}
      {showTableSelector && (
        <TableSelectorModal
          tables={tables}
          selectedTableId={selectedTable?.id ?? null}
          onSelect={(table) => {
            setSelectedTable(table);
            setShowTableSelector(false);
          }}
          onClose={() => setShowTableSelector(false)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// F&B: Table Selector Modal
// ─────────────────────────────────────────────

const TABLE_STATUS_CONFIG: Record<TableStatus, { label: string; color: string; bg: string }> = {
  EMPTY: { label: "Kosong", color: "text-green-700", bg: "bg-green-50 border-green-200" },
  OCCUPIED: { label: "Terisi", color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
  BILL: { label: "Minta Bill", color: "text-orange-700", bg: "bg-orange-50 border-orange-200" },
  RESERVED: { label: "Dipesan", color: "text-purple-700", bg: "bg-purple-50 border-purple-200" },
};

function TableSelectorModal({
  tables,
  selectedTableId,
  onSelect,
  onClose,
}: {
  tables: TableInfo[];
  selectedTableId: string | null;
  onSelect: (table: TableInfo | null) => void;
  onClose: () => void;
}) {
  const [loadingTableId, setLoadingTableId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const areas = [...new Set(tables.map((t) => t.area || "Umum"))];

  async function handleTableClick(table: TableInfo) {
    setErrorMsg(null);

    // Meja sudah ada order aktif — langsung pilih
    if (table.status !== "EMPTY" && table.activeOrderId) {
      onSelect(table);
      return;
    }

    // Meja EMPTY — buka TableOrder baru dulu
    setLoadingTableId(table.id);
    try {
      const res = await fetch(`/api/tables/${table.id}/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Gagal membuka order meja.");
        return;
      }
      // Update table dengan activeOrderId baru dan status OCCUPIED
      const updatedTable: TableInfo = {
        ...table,
        status: "OCCUPIED",
        activeOrderId: data.tableOrder.id,
      };
      onSelect(updatedTable);
    } catch {
      setErrorMsg("Gagal terhubung ke server. Coba lagi.");
    } finally {
      setLoadingTableId(null);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">Pilih Meja</h2>
          <div className="flex items-center gap-2">
            {selectedTableId !== null && (
              <button
                onClick={() => onSelect(null)}
                className="text-xs text-orange-600 hover:text-orange-800 px-2 py-1 rounded hover:bg-orange-50 transition-colors"
              >
                Batalkan pilihan
              </button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Error message */}
          {errorMsg && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
              {errorMsg}
            </div>
          )}

          {/* Opsi tanpa meja (takeaway) */}
          <button
            onClick={() => onSelect(null)}
            className={`w-full p-3 rounded-xl border-2 text-left transition-all ${
              selectedTableId === null
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <p className="font-semibold text-gray-900 text-sm">🥡 Takeaway / Tanpa Meja</p>
            <p className="text-xs text-gray-500 mt-0.5">Order dibawa pulang atau tanpa meja</p>
          </button>

          {tables.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p className="text-sm">Belum ada meja. Tambahkan di halaman Meja.</p>
            </div>
          ) : (
            areas.map((area) => {
              const areaTables = tables.filter((t) => (t.area || "Umum") === area);
              return (
                <div key={area}>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{area}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {areaTables.map((table) => {
                      const cfg = TABLE_STATUS_CONFIG[table.status];
                      const isSelected = selectedTableId === table.id;
                      const isLoading = loadingTableId === table.id;
                      return (
                        <button
                          key={table.id}
                          onClick={() => handleTableClick(table)}
                          disabled={isLoading}
                          className={`p-3 rounded-xl border-2 text-left transition-all ${
                            isSelected
                              ? "border-blue-500 bg-blue-50"
                              : `${cfg.bg} hover:opacity-80`
                          } ${isLoading ? "opacity-60 cursor-wait" : ""}`}
                        >
                          <p className="font-bold text-gray-900">#{table.number}</p>
                          {table.name && (
                            <p className="text-xs text-gray-500 truncate">{table.name}</p>
                          )}
                          <span className={`text-xs font-medium ${cfg.color}`}>
                            {isLoading ? "Membuka..." : cfg.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
