import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * PATCH /api/notifications/[id]/read
 * Tandai satu notifikasi sebagai sudah dibaca.
 */
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Pastikan notifikasi milik tenant ini
    const notification = await prisma.appNotification.findFirst({
      where: { id, tenantId: session.user.tenantId },
      select: { id: true },
    });

    if (!notification) {
      return NextResponse.json({ error: "Notifikasi tidak ditemukan." }, { status: 404 });
    }

    await prisma.appNotification.update({
      where: { id },
      data: { isRead: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Read notification error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
