import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import bcrypt from "bcryptjs";

// GET — list semua karyawan tenant ini
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user.tenantId || session.user.role !== "OWNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const staff = await prisma.user.findMany({
      where: { tenantId: session.user.tenantId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        outletId: true,
        outlet: { select: { name: true } },
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ staff });
  } catch (error) {
    console.error("Get staff error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST — tambah kasir baru
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user.tenantId || session.user.role !== "OWNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { name, email, password, outletId } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Nama, email, dan password wajib diisi." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password minimal 6 karakter." },
        { status: 400 }
      );
    }

    if (!outletId) {
      return NextResponse.json(
        { error: "Cabang wajib dipilih." },
        { status: 400 }
      );
    }

    // Validasi outlet milik tenant ini
    const outlet = await prisma.outlet.findFirst({
      where: {
        id: outletId,
        tenantId: session.user.tenantId,
        isActive: true,
      },
    });
    if (!outlet) {
      return NextResponse.json(
        { error: "Cabang tidak valid atau tidak aktif." },
        { status: 400 }
      );
    }

    // Cek email global unik
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "Email sudah terdaftar di sistem." },
        { status: 409 }
      );
    }

    // Cek limit kasir berdasarkan plan tenant
    const tenant = await prisma.tenant.findUnique({
      where: { id: session.user.tenantId },
      select: { maxCashiers: true, plan: true },
    });

    if (tenant) {
      const cashierCount = await prisma.user.count({
        where: { tenantId: session.user.tenantId, role: "KASIR" },
      });
      if (cashierCount >= tenant.maxCashiers) {
        return NextResponse.json(
          {
            error: `Batas kasir paket ${tenant.plan} (${tenant.maxCashiers} kasir) telah tercapai. Upgrade paket untuk menambah kasir.`,
          },
          { status: 403 }
        );
      }
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const newStaff = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: "KASIR",
        tenantId: session.user.tenantId,
        outletId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        outletId: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ staff: newStaff }, { status: 201 });
  } catch (error) {
    console.error("Create staff error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
