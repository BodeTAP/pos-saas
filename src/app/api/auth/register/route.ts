import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { generateSlug } from "@/lib/utils";
import { isValidEmail } from "@/lib/validation";
import { getPlatformConfig, PLATFORM_CONFIG_KEYS } from "@/lib/platform-config";
import { sendWelcomeEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { ownerName, email, password, storeName, phone } = body;

    // Cek apakah registrasi diaktifkan
    const registrationEnabled = await getPlatformConfig(PLATFORM_CONFIG_KEYS.REGISTRATION_ENABLED);
    if (registrationEnabled !== "true") {
      return NextResponse.json(
        { error: "Pendaftaran tenant baru sedang tidak tersedia. Silakan hubungi administrator." },
        { status: 403 }
      );
    }

    // Validasi input
    if (!ownerName || !email || !password || !storeName) {
      return NextResponse.json(
        { error: "Semua field wajib diisi." },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Format email tidak valid." },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password minimal 8 karakter." },
        { status: 400 }
      );
    }

    // Cek email sudah terdaftar
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        { error: "Email sudah terdaftar. Gunakan email lain." },
        { status: 409 }
      );
    }

    // Generate slug unik untuk toko
    let slug = generateSlug(storeName);
    const existingSlug = await prisma.tenant.findUnique({ where: { slug } });
    if (existingSlug) {
      slug = `${slug}-${Date.now()}`;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Buat tenant dan user dalam satu transaksi
    const trialDaysStr = await getPlatformConfig(PLATFORM_CONFIG_KEYS.TRIAL_DAYS);
    const trialDays = parseInt(trialDaysStr) || 14;
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);

    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: storeName,
          slug,
          email,
          phone: phone || null,
          plan: "FREE",
          subscriptionStatus: "TRIAL",
          trialEndsAt,
        },
      });

      // Auto-create outlet utama
      const mainOutlet = await tx.outlet.create({
        data: {
          name: "Cabang Utama",
          isMain: true,
          isActive: true,
          tenantId: tenant.id,
        },
      });

      const user = await tx.user.create({
        data: {
          name: ownerName,
          email,
          password: hashedPassword,
          role: "OWNER",
          tenantId: tenant.id,
          outletId: mainOutlet.id,
        },
      });

      return { tenant, user, outlet: mainOutlet };
    });

    // Kirim email selamat datang (fire-and-forget, tidak blokir response)
    sendWelcomeEmail({
      to: email,
      ownerName,
      storeName,
      trialDays,
    }).catch((err) => console.error("Welcome email error:", err));

    return NextResponse.json(
      {
        message: "Registrasi berhasil! Silakan login.",
        tenantId: result.tenant.id,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan server. Silakan coba lagi." },
      { status: 500 }
    );
  }
}
