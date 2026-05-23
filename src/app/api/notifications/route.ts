import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * GET /api/notifications
 * Ambil notifikasi terbaru untuk tenant.
 * Dipakai oleh polling hook di frontend.
 * Query params: unreadOnly=true (default), limit=20
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const unreadOnly = searchParams.get("unreadOnly") !== "false";
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20") || 20));

    const [notifications, unreadCount] = await Promise.all([
      prisma.appNotification.findMany({
        where: {
          tenantId: session.user.tenantId,
          ...(unreadOnly && { isRead: false }),
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.appNotification.count({
        where: { tenantId: session.user.tenantId, isRead: false },
      }),
    ]);

    return NextResponse.json({ notifications, unreadCount });
  } catch (error) {
    console.error("Get notifications error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
