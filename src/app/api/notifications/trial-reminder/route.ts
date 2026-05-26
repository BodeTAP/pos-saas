import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendTrialEndingEmail } from "@/lib/email";
import { auth } from "@/lib/auth";

/**
 * POST /api/notifications/trial-reminder
 * Kirim email reminder trial akan berakhir ke tenant yang trialEndsAt-nya
 * dalam 3 hari atau 1 hari ke depan.
 *
 * Dipanggil via:
 * 1. Super Admin manual dari panel settings
 * 2. Vercel Cron (GET) — lihat handler GET di bawah
 * 3. External cron dengan header x-cron-secret
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user.role === "SUPER_ADMIN") {
    return sendTrialReminders();
  }

  const secret = req.headers.get("x-cron-secret");
  const validSecret = process.env.CRON_SECRET;
  if (!validSecret) {
    return NextResponse.json({ error: "CRON_SECRET belum dikonfigurasi." }, { status: 503 });
  }
  if (secret !== validSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return sendTrialReminders();
}

/**
 * GET /api/notifications/trial-reminder
 * Vercel Cron memanggil endpoint ini setiap hari pukul 09.00 WIB (02.00 UTC).
 * Vercel mengirim header: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const validSecret = process.env.CRON_SECRET;

  if (!validSecret) {
    return NextResponse.json({ error: "CRON_SECRET belum dikonfigurasi." }, { status: 503 });
  }

  if (authHeader !== `Bearer ${validSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return sendTrialReminders();
}

async function sendTrialReminders() {
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
