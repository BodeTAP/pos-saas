"use client";

import { useEffect, useCallback, useRef } from "react";
import {
  getOfflineDB,
  setLastSyncAt,
  isSyncStale,
  SYNC_KEYS,
  type OfflineProduct,
  type OfflineCategory,
  type OfflineTenantConfig,
} from "@/lib/offline-db";

interface SyncData {
  products: OfflineProduct[];
  categories: OfflineCategory[];
  config: Omit<OfflineTenantConfig, "id"> | null;
  syncedAt: string;
}

interface UseOfflineSyncOptions {
  /** Paksa sync meski belum stale */
  force?: boolean;
  /** Callback setelah sync berhasil */
  onSynced?: () => void;
  /** Callback jika sync gagal */
  onError?: (err: Error) => void;
}

/**
 * Hook untuk sinkronisasi data produk & config ke IndexedDB.
 * Dipanggil di halaman POS saat online.
 * Hanya sync jika data sudah stale (> 24 jam) atau force = true.
 */
export function useOfflineSync(options: UseOfflineSyncOptions = {}) {
  const { force = false, onSynced, onError } = options;
  const syncingRef = useRef(false);

  const sync = useCallback(async () => {
    // Jangan sync di server side atau jika sedang sync
    if (typeof window === "undefined" || syncingRef.current) return;

    // Cek apakah perlu sync
    const stale = await isSyncStale(SYNC_KEYS.PRODUCTS);
    if (!stale && !force) return;

    // Cek koneksi
    if (!navigator.onLine) return;

    syncingRef.current = true;
    try {
      const res = await fetch("/api/offline/sync-data", {
        // Bypass service worker cache untuk mendapat data fresh
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(`Sync gagal: ${res.status}`);
      }

      const data: SyncData = await res.json();
      const db = getOfflineDB();

      // Simpan ke IndexedDB dalam satu transaksi besar
      await db.transaction(
        "rw",
        [db.products, db.categories, db.tenantConfig],
        async () => {
          // Clear dan replace semua produk
          await db.products.clear();
          if (data.products.length > 0) {
            await db.products.bulkPut(data.products);
          }

          // Clear dan replace semua kategori
          await db.categories.clear();
          if (data.categories.length > 0) {
            await db.categories.bulkPut(data.categories);
          }

          // Simpan config tenant
          if (data.config) {
            await db.tenantConfig.put({ id: "current", ...data.config });
          }
        }
      );

      // Update timestamp sync
      await setLastSyncAt(SYNC_KEYS.PRODUCTS);
      await setLastSyncAt(SYNC_KEYS.CONFIG);

      onSynced?.();
    } catch (err) {
      console.warn("Offline sync error:", err);
      onError?.(err instanceof Error ? err : new Error(String(err)));
    } finally {
      syncingRef.current = false;
    }
  }, [force, onSynced, onError]);

  // Sync saat mount (jika online)
  useEffect(() => {
    sync();
  }, [sync]);

  // Sync saat koneksi kembali online
  useEffect(() => {
    const handleOnline = () => {
      sync();
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [sync]);

  return { sync };
}

/**
 * Ambil produk dari IndexedDB (untuk mode offline)
 */
export async function getOfflineProducts(): Promise<OfflineProduct[]> {
  try {
    const db = getOfflineDB();
    return await db.products.where("isActive").equals(1).toArray();
  } catch {
    return [];
  }
}

/**
 * Ambil kategori dari IndexedDB
 */
export async function getOfflineCategories(): Promise<OfflineCategory[]> {
  try {
    const db = getOfflineDB();
    return await db.categories.toArray();
  } catch {
    return [];
  }
}

/**
 * Ambil config tenant dari IndexedDB
 */
export async function getOfflineConfig(): Promise<OfflineTenantConfig | null> {
  try {
    const db = getOfflineDB();
    return (await db.tenantConfig.get("current")) ?? null;
  } catch {
    return null;
  }
}

/**
 * Update stok produk di IndexedDB setelah transaksi offline.
 * Untuk produk varian, kurangi stok di variantSKUs[].stock.
 * Untuk produk biasa, kurangi product.stock.
 */
export async function decrementOfflineStock(
  items: Array<{ productId: string; quantity: number; variantSkuId?: string | null }>
): Promise<void> {
  try {
    const db = getOfflineDB();
    await db.transaction("rw", db.products, async () => {
      for (const item of items) {
        const product = await db.products.get(item.productId);
        if (!product) continue;

        if (item.variantSkuId && product.variantSKUs) {
          // Kurangi stok varian spesifik
          const updatedSKUs = product.variantSKUs.map((sku) => {
            if (sku.id !== item.variantSkuId) return sku;
            return { ...sku, stock: Math.max(0, sku.stock - item.quantity) };
          });
          await db.products.update(item.productId, { variantSKUs: updatedSKUs });
        } else {
          // Kurangi stok produk biasa
          await db.products.update(item.productId, {
            stock: Math.max(0, product.stock - item.quantity),
          });
        }
      }
    });
  } catch (err) {
    console.warn("Failed to update offline stock:", err);
  }
}
