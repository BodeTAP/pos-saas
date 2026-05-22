import { create } from "zustand";

export interface CartItem {
  productId: string;
  name: string;
  sku?: string;
  price: number;
  quantity: number;
  discount: number;
  subtotal: number;
  stock?: number;    // stok tersedia di outlet aktif
  minStock?: number; // batas minimum stok
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
  updateQuantity: (productId: string, quantity: number) => void;
  updateItemDiscount: (productId: string, discount: number) => void;
  removeItem: (productId: string) => void;
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
      const existing = state.items.find((i) => i.productId === newItem.productId);
      if (existing) {
        const updatedItems = state.items.map((i) =>
          i.productId === newItem.productId
            ? {
                ...i,
                quantity: i.quantity + newItem.quantity,
                subtotal: (i.quantity + newItem.quantity) * i.price - i.discount,
                // Update stock info jika ada
                stock: newItem.stock ?? i.stock,
                minStock: newItem.minStock ?? i.minStock,
              }
            : i
        );
        return { items: updatedItems };
      }
      const item: CartItem = {
        ...newItem,
        subtotal: newItem.quantity * newItem.price - newItem.discount,
      };
      return { items: [...state.items, item] };
    });
  },

  updateQuantity: (productId, quantity) => {
    if (quantity <= 0) {
      set((state) => ({
        items: state.items.filter((i) => i.productId !== productId),
      }));
      return;
    }
    set((state) => ({
      items: state.items.map((i) =>
        i.productId === productId
          ? { ...i, quantity, subtotal: quantity * i.price - i.discount }
          : i
      ),
    }));
  },

  updateItemDiscount: (productId, discount) => {
    set((state) => ({
      items: state.items.map((i) =>
        i.productId === productId
          ? { ...i, discount, subtotal: i.quantity * i.price - discount }
          : i
      ),
    }));
  },

  removeItem: (productId) => {
    set((state) => ({
      items: state.items.filter((i) => i.productId !== productId),
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
