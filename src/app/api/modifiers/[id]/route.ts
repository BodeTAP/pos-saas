import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * PUT /api/modifiers/[id]
 * Update modifier group + options (replace all options).
 */
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

    const existing = await prisma.modifierGroup.findFirst({
      where: { id, tenantId: session.user.tenantId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Modifier group tidak ditemukan." }, { status: 404 });
    }

    const body = await req.json();
    const { name, required, multiple, minSelect, maxSelect, options } = body as {
      name: string;
      required?: boolean;
      multiple?: boolean;
      minSelect?: number;
      maxSelect?: number;
      options: Array<{ name: string; extraPrice?: number; isDefault?: boolean; position?: number }>;
    };

    if (!name?.trim()) {
      return NextResponse.json({ error: "Nama grup modifier wajib diisi." }, { status: 400 });
    }
    if (!options || options.length === 0) {
      return NextResponse.json({ error: "Minimal satu opsi modifier wajib diisi." }, { status: 400 });
    }

    // Replace semua options (delete + recreate)
    const group = await prisma.$transaction(async (tx) => {
      await tx.modifierOption.deleteMany({ where: { groupId: id } });
      return tx.modifierGroup.update({
        where: { id },
        data: {
          name: name.trim(),
          required: required ?? false,
          multiple: multiple ?? false,
          minSelect: minSelect ?? 0,
          maxSelect: maxSelect ?? 1,
          options: {
            create: options.map((opt, idx) => ({
              name: opt.name.trim(),
              extraPrice: opt.extraPrice ?? 0,
              isDefault: opt.isDefault ?? false,
              position: opt.position ?? idx,
            })),
          },
        },
        include: { options: { orderBy: { position: "asc" } } },
      });
    });

    return NextResponse.json({ group });
  } catch (error) {
    console.error("Update modifier error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/modifiers/[id]
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user.tenantId || session.user.role !== "OWNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const existing = await prisma.modifierGroup.findFirst({
      where: { id, tenantId: session.user.tenantId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Modifier group tidak ditemukan." }, { status: 404 });
    }

    await prisma.modifierGroup.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete modifier error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
