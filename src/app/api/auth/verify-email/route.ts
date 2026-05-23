import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { sendVerificationEmail } from "@/lib/email";
import { auth } from "@/lib/auth";

const TOKEN_EXPIRY_HOURS = 24;

/**
 * GET /api/auth/verify-email?token=xxx
 * Verifikasi email menggunakan token dari link email.
 */
export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token");

    if (!token || token.length !== 64 || !/^[a-f0-9]+$/.test(token)) {
      return NextResponse.redirect(
        new URL("/verify-email?status=invalid", req.url)
      );
    }

    // Cari token di VerificationToken (pakai identifier = "email-verify")
    const verificationToken = await prisma.verificationToken.findUnique({
      where: { token },
    });

    if (!verificationToken) {
      return NextResponse.redirect(
        new URL("/verify-email?status=invalid", req.url)
      );
    }

    if (verificationToken.expires < new Date()) {
      // Hapus token expired
      await prisma.verificationToken.delete({ where: { token } }).catch(() => {});
      return NextResponse.redirect(
        new URL("/verify-email?status=expired", req.url)
      );
    }

    // Tandai email sebagai verified
    const email = verificationToken.identifier;

    await prisma.$transaction([
      prisma.user.updateMany({
        where: { email, emailVerified: null },
        data: { emailVerified: new Date() },
      }),
      prisma.verificationToken.delete({ where: { token } }),
    ]);

    return NextResponse.redirect(
      new URL("/verify-email?status=success", req.url)
    );
  } catch (error) {
    console.error("Verify email error:", error);
    return NextResponse.redirect(
      new URL("/verify-email?status=error", req.url)
    );
  }
}

/**
 * POST /api/auth/verify-email
 * Kirim ulang email verifikasi (resend).
 * Hanya untuk user yang sudah login dan belum verifikasi.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, name: true, email: true, emailVerified: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User tidak ditemukan." }, { status: 404 });
    }

    if (user.emailVerified) {
      return NextResponse.json({ error: "Email sudah terverifikasi." }, { status: 400 });
    }

    // Rate limit: cek apakah sudah ada token aktif yang dibuat < 5 menit lalu
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const existingToken = await prisma.verificationToken.findFirst({
      where: {
        identifier: user.email,
        expires: { gt: fiveMinutesAgo },
      },
    });

    if (existingToken) {
      return NextResponse.json(
        { error: "Email verifikasi baru saja dikirim. Tunggu 5 menit sebelum kirim ulang." },
        { status: 429 }
      );
    }

    // Hapus token lama
    await prisma.verificationToken.deleteMany({
      where: { identifier: user.email },
    });

    // Buat token baru
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    await prisma.verificationToken.create({
      data: { identifier: user.email, token, expires },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const verifyUrl = `${appUrl}/api/auth/verify-email?token=${token}`;

    sendVerificationEmail({
      to: user.email,
      name: user.name,
      verifyUrl,
    }).catch((err) => console.error("Verification email error:", err));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Resend verification error:", error);
    return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 });
  }
}

/**
 * Helper: kirim email verifikasi saat registrasi baru.
 * Dipanggil dari register route.
 */
export async function sendEmailVerification(email: string, name: string): Promise<void> {
  try {
    // Hapus token lama jika ada
    await prisma.verificationToken.deleteMany({ where: { identifier: email } });

    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    await prisma.verificationToken.create({
      data: { identifier: email, token, expires },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const verifyUrl = `${appUrl}/api/auth/verify-email?token=${token}`;

    sendVerificationEmail({ to: email, name, verifyUrl }).catch(
      (err) => console.error("Verification email error:", err)
    );
  } catch (err) {
    console.error("sendEmailVerification error:", err);
  }
}
