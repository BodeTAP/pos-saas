import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmailVerification } from "@/lib/email-verification";
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

    const verificationToken = await prisma.verificationToken.findUnique({
      where: { token },
    });

    if (!verificationToken) {
      return NextResponse.redirect(
        new URL("/verify-email?status=invalid", req.url)
      );
    }

    if (verificationToken.expires < new Date()) {
      await prisma.verificationToken.delete({ where: { token } }).catch(() => {});
      return NextResponse.redirect(
        new URL("/verify-email?status=expired", req.url)
      );
    }

    const email = verificationToken.identifier;

    await prisma.$transaction([
      prisma.user.updateMany({
        where: { email, emailVerified: null },
        data: { emailVerified: new Date() },
      }),
      prisma.verificationToken.delete({ where: { token } }),
    ]);

    // Redirect ke success page — Next.js akan revalidate layout saat navigasi
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

    await sendEmailVerification(user.email, user.name);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Resend verification error:", error);
    return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 });
  }
}
