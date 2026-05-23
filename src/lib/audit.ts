/**
 * Audit log helper.
 * Dipanggil setelah operasi mutasi berhasil di API routes.
 * Fire-and-forget — tidak memblokir response.
 */

import { prisma } from "@/lib/prisma";

export type AuditAction = "CREATE" | "UPDATE" | "DELETE";

export interface AuditOptions {
  action: AuditAction;
  entity: string;        // "Product" | "Category" | "Staff" | "Outlet" | "Settings" | "Customer" | "PurchaseOrder"
  entityId?: string;
  entityName?: string;   // Snapshot nama untuk referensi setelah delete
  changes?: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  };
  userId: string;
  tenantId: string;
}

/**
 * Catat aktivitas ke audit_logs.
 * Selalu fire-and-forget — error tidak dilempar ke caller.
 */
export function logAudit(opts: AuditOptions): void {
  prisma.auditLog
    .create({
      data: {
        action: opts.action,
        entity: opts.entity,
        entityId: opts.entityId ?? null,
        entityName: opts.entityName ?? null,
        // Cast ke Prisma InputJsonValue — struktur { before, after } selalu valid JSON
        changes: opts.changes
          ? (opts.changes as Parameters<typeof prisma.auditLog.create>[0]["data"]["changes"])
          : undefined,
        userId: opts.userId,
        tenantId: opts.tenantId,
      },
    })
    .catch((err) => console.error("[audit] Failed to write audit log:", err));
}

/**
 * Hitung diff antara before dan after — hanya field yang berubah.
 * Berguna untuk UPDATE agar log tidak terlalu besar.
 */
export function diffObjects(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): { before: Record<string, unknown>; after: Record<string, unknown> } | null {
  const changedBefore: Record<string, unknown> = {};
  const changedAfter: Record<string, unknown> = {};

  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of allKeys) {
    // Skip internal fields
    if (["password", "updatedAt", "createdAt"].includes(key)) continue;
    const bVal = JSON.stringify(before[key]);
    const aVal = JSON.stringify(after[key]);
    if (bVal !== aVal) {
      changedBefore[key] = before[key];
      changedAfter[key] = after[key];
    }
  }

  if (Object.keys(changedBefore).length === 0) return null;
  return { before: changedBefore, after: changedAfter };
}
