/**
 * Helper untuk membuat notifikasi in-app.
 * Fire-and-forget — tidak memblokir response API.
 */

import { prisma } from "@/lib/prisma";
import { NotificationType } from "@prisma/client";

export interface CreateNotificationOptions {
  tenantId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}

/**
 * Buat notifikasi in-app untuk tenant.
 * Selalu fire-and-forget — error tidak dilempar ke caller.
 *
 * Deduplication: untuk LOW_STOCK, cek apakah notifikasi yang sama
 * sudah ada dalam 1 jam terakhir agar tidak spam.
 */
export function createNotification(opts: CreateNotificationOptions): void {
  _createNotification(opts).catch((err) =>
    console.error("[notification] Failed to create notification:", err)
  );
}

async function _createNotification(opts: CreateNotificationOptions): Promise<void> {
  // Dedup LOW_STOCK: jangan buat notifikasi yang sama dalam 1 jam
  if (opts.type === "LOW_STOCK") {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const existing = await prisma.appNotification.findFirst({
      where: {
        tenantId: opts.tenantId,
        type: "LOW_STOCK",
        title: opts.title,
        createdAt: { gte: oneHourAgo },
      },
      select: { id: true },
    });
    if (existing) return; // sudah ada, skip
  }

  // Batasi total notifikasi belum dibaca per tenant (max 100)
  // Hapus yang paling lama jika sudah penuh
  const unreadCount = await prisma.appNotification.count({
    where: { tenantId: opts.tenantId, isRead: false },
  });
  if (unreadCount >= 100) {
    const oldest = await prisma.appNotification.findFirst({
      where: { tenantId: opts.tenantId, isRead: false },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (oldest) {
      await prisma.appNotification.delete({ where: { id: oldest.id } });
    }
  }

  await prisma.appNotification.create({
    data: {
      type: opts.type,
      title: opts.title,
      message: opts.message,
      link: opts.link ?? null,
      tenantId: opts.tenantId,
    },
  });
}

/**
 * Buat notifikasi stok menipis/habis setelah transaksi.
 * Dipanggil dengan daftar produk yang stoknya turun.
 */
export function notifyLowStock(
  tenantId: string,
  items: Array<{ productName: string; stock: number; minStock: number; outletName: string }>
): void {
  for (const item of items) {
    const isOut = item.stock === 0;
    createNotification({
      tenantId,
      type: "LOW_STOCK",
      title: isOut ? `Stok Habis: ${item.productName}` : `Stok Menipis: ${item.productName}`,
      message: isOut
        ? `Stok ${item.productName} di ${item.outletName} sudah habis.`
        : `Stok ${item.productName} di ${item.outletName} tersisa ${item.stock} ${item.stock === 1 ? "unit" : "unit"} (min: ${item.minStock}).`,
      link: "/dashboard/inventory",
    });
  }
}
