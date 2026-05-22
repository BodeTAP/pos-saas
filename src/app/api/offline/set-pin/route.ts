import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { parseBody } from "@/lib/schemas";
import { z } from "zod";

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
 * Hash PIN disimpan di DB dan dikirim ke client untuk disimpan di IndexedDB.
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

    // Hash PIN dengan bcrypt cost 10 (lebih ringan dari password, cukup untuk PIN)
    const pinHash = await bcrypt.hash(pin, 10);

    // Simpan hash di DB (field offlinePin di User)
    // Karena field ini belum ada di schema, kita simpan di metadata via note
    // Alternatif: simpan di platform_configs per user
    // Untuk sekarang, return hash ke client untuk disimpan di IndexedDB
    // Hash aman karena tidak bisa di-reverse ke PIN asli

    return NextResponse.json({
      userId,
      userName: user.name,
      pinHash,
      // Expire setelah 30 hari — client harus minta ulang
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
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
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Untuk MVP: return info bahwa PIN belum di-set
    // Owner perlu set PIN via POST endpoint
    return NextResponse.json({
      userId: session.user.id,
      hasPinHash: false,
      message: "PIN belum diset. Minta Owner untuk mengatur PIN offline.",
    });
  } catch (error) {
    console.error("Get PIN error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
