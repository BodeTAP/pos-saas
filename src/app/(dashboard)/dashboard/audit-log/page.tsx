import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NoTenant } from "@/components/ui/no-tenant";
import { redirect } from "next/navigation";
import { AuditLogClient } from "./audit-log-client";

interface SearchParams {
  page?: string;
  action?: string;
  entity?: string;
  userId?: string;
  start?: string;
  end?: string;
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  if (!session?.user.tenantId) return <NoTenant />;
  if (session.user.role !== "OWNER") redirect("/dashboard");

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1") || 1);
  const limit = 50;
  const skip = (page - 1) * limit;

  const VALID_ACTIONS = ["CREATE", "UPDATE", "DELETE"];
  const VALID_ENTITIES = ["Product", "Category", "Staff", "Outlet", "Settings", "Customer", "PurchaseOrder"];

  const safeAction = params.action && VALID_ACTIONS.includes(params.action) ? params.action : null;
  const safeEntity = params.entity && VALID_ENTITIES.includes(params.entity) ? params.entity : null;

  const since = params.start ? new Date(params.start) : null;
  const until = params.end ? new Date(params.end) : null;
  if (since) since.setHours(0, 0, 0, 0);
  if (until) until.setHours(23, 59, 59, 999);

  const where = {
    tenantId: session.user.tenantId,
    ...(safeAction && { action: safeAction }),
    ...(safeEntity && { entity: safeEntity }),
    ...(params.userId && { userId: params.userId }),
    ...((since || until) && {
      createdAt: {
        ...(since && { gte: since }),
        ...(until && { lte: until }),
      },
    }),
  };

  const [logs, total, staffList] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
    // Daftar staff untuk filter dropdown
    prisma.user.findMany({
      where: { tenantId: session.user.tenantId, isActive: true },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <AuditLogClient
      logs={logs.map((l) => ({
        ...l,
        changes: l.changes as Record<string, unknown> | null,
      }))}
      total={total}
      page={page}
      limit={limit}
      staffList={staffList}
      filters={{
        action: safeAction,
        entity: safeEntity,
        userId: params.userId || null,
        start: params.start || null,
        end: params.end || null,
      }}
    />
  );
}
