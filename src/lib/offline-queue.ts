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
  serviceChargePct?: number;
  serviceCharge?: number;
  total: number;
  amountPaid: number;
  change: number;
  paymentMethod: string;
  note: string | null;
  cashierId: string;
  tenantId: string;
  customerId: string | null;
  pointsRedeemed: number;
  tableOrderId?: string | null;
}

/**
 * Tambahkan transaksi ke offline queue.
 * Return localId untuk tracking.
 *
 * Invoice number lokal include UUID short (8 char) untuk mencegah collision
 * meski 2 transaksi dibuat di milidetik yang sama.
 */
export async function enqueueOfflineTransaction(
  payload: OfflineTransactionPayload,
  invoicePrefix = "INV"
): Promise<{ localId: string; invoiceNumber: string }> {
  const db = getOfflineDB();
  const localId = crypto.randomUUID();
  // Buat invoice lokal yang dijamin unik antar transaksi offline:
  // base invoice number + suffix UUID 8 char pertama
  const baseInvoice = generateInvoiceNumber(invoicePrefix);
  const uniqueSuffix = localId.slice(0, 8).toUpperCase();
  const invoiceNumber = `${baseInvoice}-${uniqueSuffix}`;

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

// Module-level lock — mencegah sync paralel meski dipanggil dari multiple hook instance
let _syncInProgress = false;

/**
 * Sync semua transaksi PENDING_SYNC ke server.
 * Dipanggil saat koneksi kembali online.
 * Return array hasil sync per transaksi.
 *
 * Idempotent — kalau sudah ada sync yang jalan, return [] tanpa start sync baru.
 */
export async function syncOfflineQueue(): Promise<SyncResult[]> {
  if (typeof window === "undefined" || !navigator.onLine) return [];
  if (_syncInProgress) return []; // Cegah sync paralel

  _syncInProgress = true;
  try {
    const db = getOfflineDB();
    const pending = await db.offlineQueue
      .where("status")
      .equals("PENDING_SYNC")
      .toArray();

    if (pending.length === 0) return [];

    // Batch sync — kirim semua transaksi dalam 1 request (bukan N request)
    return await batchSyncTransactions(pending);
  } finally {
    _syncInProgress = false;
  }
}

/**
 * Kirim batch transaksi ke server dalam satu request.
 * Server endpoint sudah support batch (array of transactions).
 */
async function batchSyncTransactions(
  pending: OfflineQueueItem[]
): Promise<SyncResult[]> {
  const db = getOfflineDB();
  const results: SyncResult[] = [];

  // Tandai semua sebagai SYNCING
  await db.transaction("rw", db.offlineQueue, async () => {
    for (const item of pending) {
      await db.offlineQueue.update(item.id!, { status: "SYNCING" });
    }
  });

  try {
    const transactions = pending.map((item) => ({
      localId: item.localId,
      invoiceNumber: item.invoiceNumber,
      payload: JSON.parse(item.payload) as OfflineTransactionPayload,
    }));

    const res = await fetch("/api/offline/sync-transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactions }),
    });

    const data = await res.json();

    if (!res.ok) {
      // Server error — kembalikan semua ke PENDING_SYNC untuk retry nanti
      for (const item of pending) {
        await db.offlineQueue.update(item.id!, {
          status: "PENDING_SYNC",
          error: data.error || `Server error ${res.status}`,
          retryCount: (item.retryCount || 0) + 1,
        });
      }
      return [];
    }

    // Process per-item result
    const serverResults = (data.results as Array<{
      localId: string;
      status: "SYNCED" | "FAILED" | "SKIPPED";
      serverInvoiceNumber?: string;
      error?: string;
    }>) || [];

    const resultByLocalId = new Map(serverResults.map((r) => [r.localId, r]));

    for (const item of pending) {
      const serverResult = resultByLocalId.get(item.localId);

      if (!serverResult) {
        // Server tidak return result untuk localId ini — anggap pending lagi
        await db.offlineQueue.update(item.id!, {
          status: "PENDING_SYNC",
          retryCount: (item.retryCount || 0) + 1,
        });
        continue;
      }

      if (serverResult.status === "SYNCED" || serverResult.status === "SKIPPED") {
        await db.offlineQueue.update(item.id!, {
          status: "SYNCED",
          syncedAt: Date.now(),
          error: null,
        });
        results.push({
          localId: item.localId,
          invoiceNumber: item.invoiceNumber,
          status: "SYNCED",
          serverInvoiceNumber: serverResult.serverInvoiceNumber,
        });
      } else {
        await db.offlineQueue.update(item.id!, {
          status: "FAILED",
          error: serverResult.error || "Sync gagal",
          retryCount: (item.retryCount || 0) + 1,
        });
        results.push({
          localId: item.localId,
          invoiceNumber: item.invoiceNumber,
          status: "FAILED",
          error: serverResult.error,
        });
      }
    }

    return results;
  } catch (err) {
    // Network error — kembalikan semua ke PENDING_SYNC
    const errorMsg = err instanceof Error ? err.message : "Network error";
    for (const item of pending) {
      await db.offlineQueue.update(item.id!, {
        status: "PENDING_SYNC",
        error: errorMsg,
        retryCount: (item.retryCount || 0) + 1,
      });
    }
    return [];
  }
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
