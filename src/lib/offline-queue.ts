/**
 * Offline transaction queue manager.
 * Menyimpan transaksi ke IndexedDB saat offline,
 * lalu sync ke server saat koneksi kembali.
 */

import { getOfflineDB, type OfflineQueueItem } from "@/lib/offline-db";
import { generateInvoiceNumber } from "@/lib/utils";

// ─────────────────────────────────────────────
// ENQUEUE
// ─────────────────────────────────────────────

export interface OfflineTransactionPayload {
  items: Array<{
    productId: string;
    productName: string;
    productSku?: string | null;
    quantity: number;
    unitPrice: number;
    discount: number;
    subtotal: number;
    variantSkuId?: string | null;
    variantLabel?: string | null;
  }>;
  subtotal: number;
  discount: number;
  discountPct: number;
  discountNominal: number;
  tax: number;
  taxPct: number;
  total: number;
  amountPaid: number;
  change: number;
  paymentMethod: string;
  note: string | null;
  cashierId: string;
  tenantId: string;
  customerId: string | null;
  pointsRedeemed: number;
}

/**
 * Tambahkan transaksi ke offline queue.
 * Return localId untuk tracking.
 */
export async function enqueueOfflineTransaction(
  payload: OfflineTransactionPayload,
  invoicePrefix = "INV"
): Promise<{ localId: string; invoiceNumber: string }> {
  const db = getOfflineDB();
  const localId = crypto.randomUUID();
  const invoiceNumber = generateInvoiceNumber(invoicePrefix);

  await db.offlineQueue.add({
    localId,
    invoiceNumber,
    payload: JSON.stringify(payload),
    status: "PENDING_SYNC",
    createdAt: Date.now(),
    syncedAt: null,
    error: null,
    retryCount: 0,
  });

  return { localId, invoiceNumber };
}

// ─────────────────────────────────────────────
// QUEUE STATUS
// ─────────────────────────────────────────────

export async function getPendingQueueCount(): Promise<number> {
  try {
    const db = getOfflineDB();
    return await db.offlineQueue
      .where("status")
      .equals("PENDING_SYNC")
      .count();
  } catch {
    return 0;
  }
}

export async function getFailedQueueCount(): Promise<number> {
  try {
    const db = getOfflineDB();
    return await db.offlineQueue.where("status").equals("FAILED").count();
  } catch {
    return 0;
  }
}

export async function getAllQueueItems(): Promise<OfflineQueueItem[]> {
  try {
    const db = getOfflineDB();
    return await db.offlineQueue.orderBy("createdAt").reverse().toArray();
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────
// SYNC
// ─────────────────────────────────────────────

export interface SyncResult {
  localId: string;
  invoiceNumber: string;
  status: "SYNCED" | "FAILED";
  serverInvoiceNumber?: string;
  error?: string;
}

/**
 * Sync semua transaksi PENDING_SYNC ke server.
 * Dipanggil saat koneksi kembali online.
 * Return array hasil sync per transaksi.
 */
export async function syncOfflineQueue(): Promise<SyncResult[]> {
  if (typeof window === "undefined" || !navigator.onLine) return [];

  const db = getOfflineDB();
  const pending = await db.offlineQueue
    .where("status")
    .equals("PENDING_SYNC")
    .toArray();

  if (pending.length === 0) return [];

  const results: SyncResult[] = [];

  for (const item of pending) {
    // Tandai sebagai SYNCING
    await db.offlineQueue.update(item.id!, { status: "SYNCING" });

    try {
      const payload = JSON.parse(item.payload) as OfflineTransactionPayload;

      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          // Kirim localId untuk idempotency di server
          offlineLocalId: item.localId,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        await db.offlineQueue.update(item.id!, {
          status: "SYNCED",
          syncedAt: Date.now(),
          error: null,
        });

        results.push({
          localId: item.localId,
          invoiceNumber: item.invoiceNumber,
          status: "SYNCED",
          serverInvoiceNumber: data.transaction?.invoiceNumber,
        });
      } else {
        const errorMsg = data.error || "Sync gagal";
        await db.offlineQueue.update(item.id!, {
          status: "FAILED",
          error: errorMsg,
          retryCount: (item.retryCount || 0) + 1,
        });

        results.push({
          localId: item.localId,
          invoiceNumber: item.invoiceNumber,
          status: "FAILED",
          error: errorMsg,
        });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Network error";
      await db.offlineQueue.update(item.id!, {
        status: "PENDING_SYNC", // Kembalikan ke PENDING agar bisa retry
        error: errorMsg,
        retryCount: (item.retryCount || 0) + 1,
      });
    }
  }

  return results;
}

/**
 * Retry transaksi yang FAILED (max 3x).
 * Transaksi yang sudah retry 3x tidak akan di-retry lagi.
 */
export async function retryFailedQueue(): Promise<SyncResult[]> {
  const db = getOfflineDB();

  // Reset FAILED yang masih bisa di-retry (retryCount < 3) ke PENDING_SYNC
  const failed = await db.offlineQueue
    .where("status")
    .equals("FAILED")
    .toArray();

  for (const item of failed) {
    if ((item.retryCount || 0) < 3) {
      await db.offlineQueue.update(item.id!, {
        status: "PENDING_SYNC",
        error: null,
      });
    }
  }

  return syncOfflineQueue();
}

/**
 * Bersihkan queue lama (SYNCED > 7 hari, FAILED > 30 hari)
 */
export async function cleanupOldQueue(): Promise<void> {
  try {
    const db = getOfflineDB();
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    await db.offlineQueue
      .where("status")
      .equals("SYNCED")
      .and((item) => item.syncedAt !== null && item.syncedAt < sevenDaysAgo)
      .delete();

    await db.offlineQueue
      .where("status")
      .equals("FAILED")
      .and((item) => item.createdAt < thirtyDaysAgo)
      .delete();
  } catch {
    // Ignore cleanup errors
  }
}
