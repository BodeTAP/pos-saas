import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * Endpoint refresh status — dipanggil dari client setiap N menit
 * untuk cek apakah tenant masih aktif. Kalau status berubah, client
 * harus call session.update() untuk refresh JWT token.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user.tenantId) {
      return NextResponse.json({ subscriptionStatus: null });
    }

    if (session.user.role === "SUPER_ADMIN") {
      return NextResponse.json({ subscriptionStatus: null });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: session.user.tenantId },
      select: { subscriptionStatus: true },
    });

    return NextResponse.json({
      subscriptionStatus: tenant?.subscriptionStatus ?? null,
      changed: tenant?.subscriptionStatus !== session.user.subscriptionStatus,
    });
  } catch (error) {
    console.error("Refresh status error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
