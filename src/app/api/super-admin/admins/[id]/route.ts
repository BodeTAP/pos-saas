import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (session?.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Tidak boleh menonaktifkan diri sendiri
    if (session.user.id === id) {
      return NextResponse.json(
        { error: "Tidak bisa mengubah status akun sendiri." },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findFirst({
      where: { id, role: "SUPER_ADMIN" },
    });
    if (!existing) {
      return NextResponse.json({ error: "Super Admin tidak ditemukan." }, { status: 404 });
    }

    const body = await req.json();
    const { isActive } = body;

    const updated = await prisma.user.update({
      where: { id },
      data: { isActive: isActive ?? existing.isActive },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
      },
    });

    return NextResponse.json({ admin: updated });
  } catch (error) {
    console.error("Update super admin error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
