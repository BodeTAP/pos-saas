import type { CartItem, CartCustomer } from "@/stores/cart-store";

export interface HeldTransaction {
  id: string;
  cashierId: string;
  items: CartItem[];
  customer: CartCustomer | null;
  discountPct: number;
  pointsToRedeem: number;
  note: string;
  heldAt: string; // ISO date
}

const STORAGE_KEY = "pos-saas-held-transactions";

export function getHeldTransactions(cashierId: string): HeldTransaction[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    const all = JSON.parse(data) as HeldTransaction[];
    // Filter hanya milik kasir ini
    return all.filter((h) => h.cashierId === cashierId);
  } catch {
    return [];
  }
}

export function saveHeldTransaction(tx: Omit<HeldTransaction, "id" | "heldAt">): HeldTransaction {
  const id = `hold-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const newHold: HeldTransaction = {
    ...tx,
    id,
    heldAt: new Date().toISOString(),
  };

  if (typeof window === "undefined") return newHold;

  try {
    const data = localStorage.getItem(STORAGE_KEY);
    const all = data ? (JSON.parse(data) as HeldTransaction[]) : [];
    all.push(newHold);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch (e) {
    console.error("Failed to save hold:", e);
  }

  return newHold;
}

export function removeHeldTransaction(id: string): void {
  if (typeof window === "undefined") return;
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return;
    const all = JSON.parse(data) as HeldTransaction[];
    const filtered = all.filter((h) => h.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.error("Failed to remove hold:", e);
  }
}
