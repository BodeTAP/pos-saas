import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

const VALID_ACTIONS = ["CREATE", "UPDATE", "DELETE"] as const;
const VALID_ENTITIES = [
  "Product", "Category", "Staff", "Outlet", "Settings",
  "Customer", "PurchaseOrder",
] as const;

/**
 * GET /api/audit-log
 * Daftar log aktivitas tenant. OWNER only.
 * Query params: action, entity, userId, start, end, page, limit
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user.tenantId || session.user.role !== "OWNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50")));
    const skip = (page - 1) * limit;

    const actionParam = searchParams.get("action");
    const entityParam = searchParams.get("entity");
    const userIdParam = searchParams.get("userId");
    const startParam = searchParams.get("start");
    const endParam = searchParams.get("end");

    // Validate & sanitize filters
    const safeAction =
      actionParam && VALID_ACTIONS.includes(actionParam as (typeof VALID_ACTIONS)[number])
        ? actionParam
        : null;
    const safeEntity =
      entityParam && VALID_ENTITIES.includes(entityParam as (typeof VALID_ENTITIES)[number])
        ? entityParam
        : null;

    const since = startParam ? new Date(startParam) : null;
    const until = endParam ? new Date(endParam) : null;
    if (since) since.setHours(0, 0, 0, 0);
    if (until) until.setHours(23, 59, 59, 999);

    const where = {
      tenantId: session.user.tenantId,
      ...(safeAction && { action: safeAction }),
      ...(safeEntity && { entity: safeEntity }),
      ...(userIdParam && { userId: userIdParam }),
      ...((since || until) && {
        createdAt: {
          ...(since && { gte: since }),
          ...(until && { lte: until }),
        },
      }),
    };

    const [logs, total] = await Promise.all([
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
    ]);

    return NextResponse.json({ logs, total, page, limit });
  } catch (error) {
    console.error("Get audit log error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
