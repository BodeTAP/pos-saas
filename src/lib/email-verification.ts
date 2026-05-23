/**
 * Helper untuk kirim email verifikasi.
 * Dipisahkan dari API route agar bisa diimport dari mana saja tanpa circular dependency.
 */

import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/email";
import crypto from "crypto";

const TOKEN_EXPIRY_HOURS = 24;

/**
 * Buat token verifikasi dan kirim email.
 * Dipanggil saat registrasi baru atau resend manual.
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
