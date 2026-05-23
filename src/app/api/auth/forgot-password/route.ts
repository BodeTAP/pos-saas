import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";
import crypto from "crypto";

const RESET_TOKEN_EXPIRY_HOURS = 1;

/**
 * POST /api/auth/forgot-password
 * Kirim email reset password.
 * Selalu return 200 agar tidak bocorkan apakah email terdaftar.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = (body.email as string)?.trim().toLowerCase();

    if (!email || !email.includes("@")) {
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

    // Kirim email
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const resetUrl = `${appUrl}/reset-password?token=${token}`;

    await sendPasswordResetEmail({
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
