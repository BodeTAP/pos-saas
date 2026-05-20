import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * Switch outlet aktif (hanya Owner)
 * Update User.outletId di database, lalu client perlu trigger session.update()
 * agar JWT token ikut ter-refresh.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Hanya Owner yang boleh switch (Kasir terikat ke outlet permanen)
    if (session.user.role !== "OWNER") {
      return NextResponse.json(
        { error: "Hanya pemilik yang bisa berpindah cabang." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { outletId } = body;

    if (!outletId) {
      return NextResponse.json(
        { error: "Outlet ID wajib disertakan." },
        { status: 400 }
      );
    }

    // Validasi outlet milik tenant ini & aktif
    const outlet = await prisma.outlet.findFirst({
      where: {
        id: outletId,
        tenantId: session.user.tenantId,
        isActive: true,
      },
    });

    if (!outlet) {
      return NextResponse.json(
        { error: "Cabang tidak ditemukan atau tidak aktif." },
        { status: 404 }
      );
    }

    // Update outletId user
    await prisma.user.update({
      where: { id: session.user.id },
      data: { outletId },
    });

    return NextResponse.json({ outlet });
  } catch (error) {
    console.error("Switch outlet error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
