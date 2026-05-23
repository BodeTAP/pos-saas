import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import {
  rateLimit,
  getClientIp,
  rateLimitResponse,
  RESET_PASSWORD_RATE_LIMIT,
} from "@/lib/rate-limit";

/**
 * POST /api/auth/reset-password
 * Reset password menggunakan token.
 */
export async function POST(req: NextRequest) {
  try {
    // Rate limit: 10 percobaan per IP per 15 menit
    const ip = getClientIp(req);
    const rlResult = rateLimit(`reset-password:ip:${ip}`, RESET_PASSWORD_RATE_LIMIT);
    if (!rlResult.success) {
      return rateLimitResponse(
        rlResult.resetIn,
        `Terlalu banyak percobaan. Coba lagi dalam ${rlResult.resetIn} detik.`
      );
    }

    const body = await req.json();
    const { token, password } = body as { token: string; password: string };

    if (!token || typeof token !== "string" || token.length !== 64) {
      return NextResponse.json({ error: "Token tidak valid." }, { status: 400 });
    }

    if (!password || password.length < 8) {
      return NextResponse.json(
        { error: "Password minimal 8 karakter." },
        { status: 400 }
      );
    }

    // Cari token yang valid
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
    });

    if (!resetToken) {
      return NextResponse.json(
        { error: "Link reset password tidak valid atau sudah digunakan." },
        { status: 400 }
      );
    }

    if (resetToken.usedAt) {
      return NextResponse.json(
        { error: "Link reset password sudah pernah digunakan." },
        { status: 400 }
      );
    }

    if (resetToken.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "Link reset password sudah kedaluwarsa. Minta link baru." },
        { status: 400 }
      );
    }

    // Cari user
    const user = await prisma.user.findUnique({
      where: { email: resetToken.email },
      select: { id: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return NextResponse.json(
        { error: "Akun tidak ditemukan atau tidak aktif." },
        { status: 400 }
      );
    }

    // Hash password baru
    const hashedPassword = await bcrypt.hash(password, 12);

    // Update password + tandai token sudah dipakai (atomic)
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      }),
      prisma.passwordResetToken.update({
        where: { token },
        data: { usedAt: new Date() },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 });
  }
}

/**
 * GET /api/auth/reset-password?token=xxx
 * Validasi token (untuk cek sebelum tampilkan form).
 */
export async function GET(req: NextRequest) {
  try {
    // Rate limit: 20 validasi per IP per 15 menit (soft limit, tidak blokir)
    const ip = getClientIp(req);
    rateLimit(`reset-password-validate:ip:${ip}`, { limit: 20, windowSec: 15 * 60 });

    const token = req.nextUrl.searchParams.get("token");

    if (!token) {
      return NextResponse.json({ valid: false, error: "Token tidak ditemukan." });
    }

    // Validasi format token (64 hex chars = 32 bytes)
    if (token.length !== 64 || !/^[a-f0-9]+$/.test(token)) {
      return NextResponse.json({ valid: false, error: "Token tidak valid." });
    }

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      select: { expiresAt: true, usedAt: true },
    });

    if (!resetToken) {
      return NextResponse.json({ valid: false, error: "Token tidak valid." });
    }
    if (resetToken.usedAt) {
      return NextResponse.json({ valid: false, error: "Token sudah digunakan." });
    }
    if (resetToken.expiresAt < new Date()) {
      return NextResponse.json({ valid: false, error: "Token sudah kedaluwarsa." });
    }

    return NextResponse.json({ valid: true });
  } catch (error) {
    console.error("Validate reset token error:", error);
    return NextResponse.json({ valid: false, error: "Terjadi kesalahan." });
  }
}
