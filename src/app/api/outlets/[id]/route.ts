import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logAudit, diffObjects } from "@/lib/audit";

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

    const existing = await prisma.outlet.findFirst({
      where: { id, tenantId: session.user.tenantId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Cabang tidak ditemukan." }, { status: 404 });
    }

    const body = await req.json();
    const { name, address, phone, isActive } = body;

    const outlet = await prisma.outlet.update({
      where: { id },
      data: {
        name: name?.trim() ?? existing.name,
        address: address !== undefined ? address || null : existing.address,
        phone: phone !== undefined ? phone || null : existing.phone,
        isActive: isActive !== undefined ? isActive : existing.isActive,
      },
    });

    const diff = diffObjects(
      { name: existing.name, address: existing.address, phone: existing.phone, isActive: existing.isActive },
      { name: outlet.name, address: outlet.address, phone: outlet.phone, isActive: outlet.isActive }
    );
    if (diff) {
      logAudit({
        action: "UPDATE",
        entity: "Outlet",
        entityId: id,
        entityName: outlet.name,
        changes: diff,
        userId: session.user.id,
        tenantId: session.user.tenantId,
      });
    }

    return NextResponse.json({ outlet });
  } catch (error) {
    console.error("Update outlet error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

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

    const existing = await prisma.outlet.findFirst({
      where: { id, tenantId: session.user.tenantId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Cabang tidak ditemukan." }, { status: 404 });
    }

    if (existing.isMain) {
      return NextResponse.json(
        { error: "Cabang utama tidak dapat dihapus." },
        { status: 400 }
      );
    }

    // Soft delete
    await prisma.outlet.update({
      where: { id },
      data: { isActive: false },
    });

    logAudit({
      action: "DELETE",
      entity: "Outlet",
      entityId: id,
      entityName: existing.name,
      userId: session.user.id,
      tenantId: session.user.tenantId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete outlet error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
