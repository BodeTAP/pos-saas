import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { generateSlug } from "@/lib/utils";
import { isValidEmail } from "@/lib/validation";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { ownerName, email, password, storeName, phone } = body;

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
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14); // 14 hari trial

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
