import { create } from "zustand";

export interface CartItem {
  productId: string;
  variantSkuId?: string | null;  // null = produk tanpa varian
  variantLabel?: string | null;  // e.g. "M / Merah"
  name: string;
  sku?: string;
  price: number;
  quantity: number;
  discount: number;
  subtotal: number;
  stock?: number;
  minStock?: number;
  // F&B: modifier yang dipilih
  modifiers?: Array<{
    groupId: string;
    groupName: string;
    optionId: string;
    optionName: string;
    extraPrice: number;
  }>;
}

export interface CartCustomer {
  id: string;
  name: string;
  phone?: string | null;
  points: number;
}

interface CartState {
  items: CartItem[];
  discountPct: number;
  discountNominal: number;
  taxPct: number;
  note: string;
  isHeld: boolean;

  // Loyalty
  customer: CartCustomer | null;
  pointsToRedeem: number; // jumlah poin yang akan ditukar (1 poin = Rp 100)

  // Actions
  addItem: (item: Omit<CartItem, "subtotal">) => void;
  updateQuantity: (productId: string, quantity: number, variantSkuId?: string | null) => void;
  updateItemDiscount: (productId: string, discount: number, variantSkuId?: string | null) => void;
  removeItem: (productId: string, variantSkuId?: string | null) => void;
  setDiscountPct: (pct: number) => void;
  setDiscountNominal: (nominal: number) => void;
  setTaxPct: (pct: number) => void;
  setNote: (note: string) => void;
  setCustomer: (customer: CartCustomer | null) => void;
  setPointsToRedeem: (points: number) => void;
  clearCart: () => void;
  loadHeld: (state: Partial<CartState>) => void;
}

export const POINT_VALUE = 100; // default, override dari tenant settings
export const POINT_PER_AMOUNT = 10000; // default, override dari tenant settings

export const useCartStore = create<CartState>((set) => ({
  items: [],
  discountPct: 0,
  discountNominal: 0,
  taxPct: 0,
  note: "",
  isHeld: false,
  customer: null,
  pointsToRedeem: 0,

  addItem: (newItem) => {
    set((state) => {
      // Key unik: productId + variantSkuId (null untuk produk tanpa varian)
      const itemKey = `${newItem.productId}:${newItem.variantSkuId ?? ""}`;
      const existing = state.items.find(
        (i) => `${i.productId}:${i.variantSkuId ?? ""}` === itemKey
      );
      if (existing) {
        const updatedItems = state.items.map((i) => {
          if (`${i.productId}:${i.variantSkuId ?? ""}` !== itemKey) return i;
          return {
            ...i,
            quantity: i.quantity + newItem.quantity,
            subtotal: (i.quantity + newItem.quantity) * i.price - i.discount,
            stock: newItem.stock ?? i.stock,
            minStock: newItem.minStock ?? i.minStock,
          };
        });
        return { items: updatedItems };
      }
      const item: CartItem = {
        ...newItem,
        subtotal: newItem.quantity * newItem.price - newItem.discount,
      };
      return { items: [...state.items, item] };
    });
  },

  updateQuantity: (productId, quantity, variantSkuId) => {
    const itemKey = `${productId}:${variantSkuId ?? ""}`;
    if (quantity <= 0) {
      set((state) => ({
        items: state.items.filter((i) => `${i.productId}:${i.variantSkuId ?? ""}` !== itemKey),
      }));
      return;
    }
    set((state) => ({
      items: state.items.map((i) =>
        `${i.productId}:${i.variantSkuId ?? ""}` === itemKey
          ? { ...i, quantity, subtotal: quantity * i.price - i.discount }
          : i
      ),
    }));
  },

  updateItemDiscount: (productId, discount, variantSkuId) => {
    const itemKey = `${productId}:${variantSkuId ?? ""}`;
    set((state) => ({
      items: state.items.map((i) =>
        `${i.productId}:${i.variantSkuId ?? ""}` === itemKey
          ? { ...i, discount, subtotal: i.quantity * i.price - discount }
          : i
      ),
    }));
  },

  removeItem: (productId, variantSkuId) => {
    const itemKey = `${productId}:${variantSkuId ?? ""}`;
    set((state) => ({
      items: state.items.filter((i) => `${i.productId}:${i.variantSkuId ?? ""}` !== itemKey),
    }));
  },

  setDiscountPct: (pct) => set({ discountPct: pct, discountNominal: 0 }),
  setDiscountNominal: (nominal) => set({ discountNominal: nominal, discountPct: 0 }),
  setTaxPct: (pct) => set({ taxPct: pct }),
  setNote: (note) => set({ note }),
  setCustomer: (customer) => set({ customer, pointsToRedeem: 0 }),
  setPointsToRedeem: (points) => set({ pointsToRedeem: Math.max(0, points) }),

  clearCart: () =>
    set({
      items: [],
      discountPct: 0,
      discountNominal: 0,
      taxPct: 0,
      note: "",
      isHeld: false,
      customer: null,
      pointsToRedeem: 0,
    }),

  loadHeld: (state) => set({ ...state, isHeld: false }),
}));
