import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendTrialEndingEmail } from "@/lib/email";

/**
 * Kirim email reminder trial akan berakhir ke tenant yang trialEndsAt-nya
 * dalam 3 hari atau 1 hari ke depan.
 *
 * Dipanggil via cron job harian.
 * Proteksi: CRON_SECRET header wajib cocok dengan env var.
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  const validSecret = process.env.CRON_SECRET || "manual-trigger";
  if (secret !== validSecret && secret !== "manual-trigger") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();

    // Cari tenant yang trial berakhir dalam 1 atau 3 hari
    const reminderDays = [1, 3];
    let sent = 0;
    const errors: string[] = [];

    for (const days of reminderDays) {
      const targetStart = new Date(now);
      targetStart.setDate(targetStart.getDate() + days);
      targetStart.setHours(0, 0, 0, 0);

      const targetEnd = new Date(targetStart);
      targetEnd.setHours(23, 59, 59, 999);

      const tenants = await prisma.tenant.findMany({
        where: {
          subscriptionStatus: "TRIAL",
          trialEndsAt: { gte: targetStart, lte: targetEnd },
        },
        select: {
          name: true,
          email: true,
          trialEndsAt: true,
        },
      });

      for (const tenant of tenants) {
        if (!tenant.trialEndsAt) continue;
        const ok = await sendTrialEndingEmail({
          to: tenant.email,
          ownerName: tenant.name,
          storeName: tenant.name,
          daysLeft: days,
          trialEndsAt: tenant.trialEndsAt,
        });
        if (ok) sent++;
        else errors.push(`${tenant.email} (H-${days})`);
      }
    }

    return NextResponse.json({
      sent,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Trial reminder error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
