import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { logAudit, diffObjects } from "@/lib/audit";

// PUT — update kasir (nama, email, password optional, status aktif)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user.tenantId || session.user.role !== "OWNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Pastikan user ini milik tenant yang sama
    const existing = await prisma.user.findFirst({
      where: { id, tenantId: session.user.tenantId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Kasir tidak ditemukan." }, { status: 404 });
    }

    // Owner tidak bisa edit dirinya sendiri lewat endpoint ini
    if (existing.role === "OWNER") {
      return NextResponse.json(
        { error: "Tidak dapat mengedit pemilik toko dari sini." },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { name, email, password, isActive, outletId } = body;

    // Cek email unik jika berubah
    if (email && email !== existing.email) {
      const duplicate = await prisma.user.findUnique({ where: { email } });
      if (duplicate) {
        return NextResponse.json(
          { error: "Email sudah dipakai user lain." },
          { status: 409 }
        );
      }
    }

    // Validasi outlet jika berubah
    if (outletId !== undefined && outletId !== existing.outletId) {
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
    }

    const updateData: {
      name?: string;
      email?: string;
      password?: string;
      isActive?: boolean;
      outletId?: string;
    } = {};

    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (outletId !== undefined) updateData.outletId = outletId;

    if (password) {
      if (password.length < 6) {
        return NextResponse.json(
          { error: "Password minimal 6 karakter." },
          { status: 400 }
        );
      }
      updateData.password = await bcrypt.hash(password, 12);
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
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
    });

    const diff = diffObjects(
      { name: existing.name, email: existing.email, isActive: existing.isActive, outletId: existing.outletId },
      { name: updated.name, email: updated.email, isActive: updated.isActive, outletId: updated.outletId }
    );
    if (diff) {
      logAudit({
        action: "UPDATE",
        entity: "Staff",
        entityId: id,
        entityName: updated.name,
        changes: diff,
        userId: session.user.id,
        tenantId: session.user.tenantId,
      });
    }

    return NextResponse.json({ staff: updated });
  } catch (error) {
    console.error("Update staff error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE — soft delete (nonaktifkan kasir)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user.tenantId || session.user.role !== "OWNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const existing = await prisma.user.findFirst({
      where: { id, tenantId: session.user.tenantId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Kasir tidak ditemukan." }, { status: 404 });
    }

    if (existing.role === "OWNER") {
      return NextResponse.json(
        { error: "Tidak dapat menghapus pemilik toko." },
        { status: 400 }
      );
    }

    // Soft delete — agar relasi transaksi tetap valid
    await prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    logAudit({
      action: "DELETE",
      entity: "Staff",
      entityId: id,
      entityName: existing.name,
      userId: session.user.id,
      tenantId: session.user.tenantId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete staff error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
