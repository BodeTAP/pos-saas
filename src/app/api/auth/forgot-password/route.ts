import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";
import crypto from "crypto";

const RESET_TOKEN_EXPIRY_HOURS = 1;
// Rate limit: max 3 request per email per 15 menit
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 3;

/**
 * POST /api/auth/forgot-password
 * Kirim email reset password.
 * Selalu return 200 agar tidak bocorkan apakah email terdaftar.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = (body.email as string)?.trim().toLowerCase();

    if (!email || !email.includes("@") || email.length > 254) {
      return NextResponse.json(
        { error: "Format email tidak valid." },
        { status: 400 }
      );
    }

    // Cari user — jangan bocorkan apakah ada atau tidak
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, isActive: true },
    });

    // Selalu return sukses meski user tidak ada (security: prevent email enumeration)
    if (!user || !user.isActive) {
      return NextResponse.json({ success: true });
    }

    // Rate limiting: cek berapa token yang dibuat dalam 15 menit terakhir
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
    const recentTokenCount = await prisma.passwordResetToken.count({
      where: {
        email,
        createdAt: { gte: windowStart },
      },
    });

    if (recentTokenCount >= RATE_LIMIT_MAX) {
      // Return sukses agar tidak bocorkan info, tapi tidak kirim email
      return NextResponse.json({ success: true });
    }

    // Hapus token lama yang belum dipakai untuk email ini
    await prisma.passwordResetToken.deleteMany({
      where: { email, usedAt: null },
    });

    // Buat token baru
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    await prisma.passwordResetToken.create({
      data: { email, token, expiresAt },
    });

    // Kirim email (fire-and-forget, tidak blokir response)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const resetUrl = `${appUrl}/reset-password?token=${token}`;

    sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      resetUrl,
    }).catch((err) => console.error("Reset password email error:", err));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Forgot password error:", error);
    // Tetap return 200 agar tidak bocorkan info
    return NextResponse.json({ success: true });
  }
}
