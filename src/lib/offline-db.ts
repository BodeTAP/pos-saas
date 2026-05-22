/**
 * IndexedDB schema menggunakan Dexie.js
 * Database lokal untuk mendukung mode offline POS
 */

import Dexie, { type Table } from "dexie";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export interface OfflineProduct {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  sellPrice: number;
  stock: number;
  minStock: number;
  unit: string;
  imageUrl: string | null;
  isActive: boolean;
  categoryId: string | null;
  categoryName: string | null;
}

export interface OfflineCategory {
  id: string;
  name: string;
}

export interface OfflineTenantConfig {
  id: string; // selalu "current"
  taxRate: number;
  currency: string;
  name: string;
  address: string | null;
  phone: string | null;
  receiptWidth: number;
  receiptNote: string | null;
  receiptHeader: string | null;
  pointsPerAmount: number;
  pointValue: number;
  activePaymentMethods: string; // JSON string
  invoicePrefix: string;
  outletId: string;
  outletName: string;
  cashierId: string;
  cashierName: string;
}

export type OfflineQueueStatus = "PENDING_SYNC" | "SYNCING" | "SYNCED" | "FAILED";

export interface OfflineQueueItem {
  id?: number; // auto-increment
  localId: string; // UUID lokal untuk idempotency
  invoiceNumber: string; // nomor invoice yang di-generate lokal
  payload: string; // JSON string dari body transaksi
  status: OfflineQueueStatus;
  createdAt: number; // timestamp ms
  syncedAt: number | null;
  error: string | null;
  retryCount: number;
}

export interface SyncMeta {
  key: string; // "products" | "config"
  lastSyncAt: number; // timestamp ms
}

// ─────────────────────────────────────────────
// DATABASE CLASS
// ─────────────────────────────────────────────

export class POSOfflineDB extends Dexie {
  products!: Table<OfflineProduct, string>;
  categories!: Table<OfflineCategory, string>;
  tenantConfig!: Table<OfflineTenantConfig, string>;
  offlineQueue!: Table<OfflineQueueItem, number>;
  syncMeta!: Table<SyncMeta, string>;

  constructor() {
    super("pos-saas-offline");

    this.version(1).stores({
      products: "id, categoryId, name, isActive",
      categories: "id, name",
      tenantConfig: "id",
      offlineQueue: "++id, localId, status, createdAt",
      syncMeta: "key",
    });
  }
}

// Singleton — hanya buat instance di client side
let _db: POSOfflineDB | null = null;

export function getOfflineDB(): POSOfflineDB {
  if (typeof window === "undefined") {
    throw new Error("IndexedDB hanya tersedia di browser");
  }
  if (!_db) {
    _db = new POSOfflineDB();
  }
  return _db;
}

// ─────────────────────────────────────────────
// SYNC META HELPERS
// ─────────────────────────────────────────────

export const SYNC_KEYS = {
  PRODUCTS: "products",
  CONFIG: "config",
} as const;

export const SYNC_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 jam

export async function getLastSyncAt(key: string): Promise<number | null> {
  try {
    const db = getOfflineDB();
    const meta = await db.syncMeta.get(key);
    return meta?.lastSyncAt ?? null;
  } catch {
    return null;
  }
}

export async function setLastSyncAt(key: string): Promise<void> {
  try {
    const db = getOfflineDB();
    await db.syncMeta.put({ key, lastSyncAt: Date.now() });
  } catch {
    // Ignore errors
  }
}

export async function isSyncStale(key: string): Promise<boolean> {
  const lastSync = await getLastSyncAt(key);
  if (!lastSync) return true;
  return Date.now() - lastSync > SYNC_MAX_AGE_MS;
}
