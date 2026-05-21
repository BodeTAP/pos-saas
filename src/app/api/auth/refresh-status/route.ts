import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { applyScheduledDowngradeIfDue } from "@/lib/billing-actions";

/**
 * Endpoint refresh status — dipanggil dari client setiap 5 menit.
 * Juga menerapkan downgrade terjadwal jika sudah waktunya.
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

    // Terapkan downgrade terjadwal jika sudah waktunya
    await applyScheduledDowngradeIfDue(session.user.tenantId);

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
    return NextResponse.json({
      subscriptionStatus: null,
      changed: false,
    });
  }
}
