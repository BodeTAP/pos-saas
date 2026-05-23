import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * POST /api/notifications/read-all
 * Tandai semua notifikasi sebagai sudah dibaca.
 */
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await prisma.appNotification.updateMany({
      where: { tenantId: session.user.tenantId, isRead: false },
      data: { isRead: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Read all notifications error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
