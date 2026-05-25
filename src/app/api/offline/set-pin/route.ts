import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { parseBody } from "@/lib/schemas";
import { z } from "zod";

const PIN_VALIDITY_DAYS = 30;

const setPinSchema = z.object({
  userId: z.string().cuid("ID user tidak valid."),
  pin: z
    .string()
    .length(6, "PIN harus 6 digit.")
    .regex(/^\d{6}$/, "PIN hanya boleh angka."),
});

/**
 * POST /api/offline/set-pin
 * Owner set PIN offline untuk kasir tertentu.
 * Hash PIN disimpan di DB (User.offlinePinHash) dan dikirim ke client
 * untuk disimpan di IndexedDB kasir.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user.tenantId || session.user.role !== "OWNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const parsed = await parseBody(req, setPinSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }

    const { userId, pin } = parsed.data;

    // Validasi user milik tenant ini
    const user = await prisma.user.findFirst({
      where: { id: userId, tenantId: session.user.tenantId, isActive: true },
      select: { id: true, name: true, role: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User tidak ditemukan." }, { status: 404 });
    }

    // Hash PIN dengan bcrypt cost 10
    const pinHash = await bcrypt.hash(pin, 10);
    const expiresAt = new Date(Date.now() + PIN_VALIDITY_DAYS * 24 * 60 * 60 * 1000);

    // Simpan di DB
    await prisma.user.update({
      where: { id: userId },
      data: {
        offlinePinHash: pinHash,
        offlinePinExpiresAt: expiresAt,
      },
    });

    return NextResponse.json({
      userId,
      userName: user.name,
      pinHash,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error("Set PIN error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/**
 * GET /api/offline/set-pin
 * Kasir ambil hash PIN miliknya sendiri saat online.
 * Disimpan di IndexedDB untuk verifikasi offline.
 *
 * Owner juga bisa pakai endpoint ini untuk cek apakah kasir sudah punya PIN.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { offlinePinHash: true, offlinePinExpiresAt: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User tidak ditemukan." }, { status: 404 });
    }

    // Belum punya PIN
    if (!user.offlinePinHash || !user.offlinePinExpiresAt) {
      return NextResponse.json({
        userId: session.user.id,
        hasPinHash: false,
        message: "PIN belum diset. Minta Owner untuk mengatur PIN offline.",
      });
    }

    // PIN sudah expired
    if (user.offlinePinExpiresAt < new Date()) {
      return NextResponse.json({
        userId: session.user.id,
        hasPinHash: false,
        message: "PIN sudah expired. Minta Owner untuk memperbarui PIN.",
      });
    }

    return NextResponse.json({
      userId: session.user.id,
      hasPinHash: true,
      pinHash: user.offlinePinHash,
      expiresAt: user.offlinePinExpiresAt.toISOString(),
    });
  } catch (error) {
    console.error("Get PIN error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/offline/set-pin
 * Owner hapus PIN offline kasir tertentu (atau kasir hapus PIN sendiri).
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId") || session.user.id;

    // Owner boleh hapus PIN kasir lain di tenant-nya
    if (userId !== session.user.id && session.user.role !== "OWNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Validasi user milik tenant ini (kalau Owner)
    if (session.user.role === "OWNER" && session.user.tenantId) {
      const target = await prisma.user.findFirst({
        where: { id: userId, tenantId: session.user.tenantId },
        select: { id: true },
      });
      if (!target) {
        return NextResponse.json({ error: "User tidak ditemukan." }, { status: 404 });
      }
    }

    await prisma.user.update({
      where: { id: userId },
      data: { offlinePinHash: null, offlinePinExpiresAt: null },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete PIN error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
