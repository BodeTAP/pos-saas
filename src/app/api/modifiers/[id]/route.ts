import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

const modifierOptionSchema = z.object({
  name: z.string().min(1, "Nama opsi wajib diisi.").max(50),
  extraPrice: z.number().nonnegative("Harga tambahan tidak boleh negatif.").default(0),
  isDefault: z.boolean().default(false),
  position: z.number().int().nonnegative().optional(),
});

const modifierGroupSchema = z
  .object({
    name: z.string().min(1, "Nama grup modifier wajib diisi.").max(100).trim(),
    required: z.boolean().default(false),
    multiple: z.boolean().default(false),
    minSelect: z.number().int().nonnegative().default(0),
    maxSelect: z.number().int().positive().default(1),
    options: z.array(modifierOptionSchema).min(1, "Minimal satu opsi modifier wajib diisi."),
  })
  .refine((data) => data.maxSelect >= data.minSelect, {
    message: "maxSelect harus >= minSelect.",
    path: ["maxSelect"],
  })
  .refine((data) => data.multiple || data.maxSelect === 1, {
    message: "Group single-pilih harus punya maxSelect = 1.",
    path: ["maxSelect"],
  })
  .refine(
    (data) => {
      const defaultCount = data.options.filter((o) => o.isDefault).length;
      if (!data.multiple && defaultCount > 1) return false;
      if (data.multiple && defaultCount > data.maxSelect) return false;
      return true;
    },
    {
      message: "Jumlah opsi default melebihi batas.",
      path: ["options"],
    }
  );

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
    const result = modifierGroupSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message ?? "Data tidak valid." },
        { status: 400 }
      );
    }
    const { name, required, multiple, minSelect, maxSelect, options } = result.data;

    // Replace semua options (delete + recreate)
    const group = await prisma.$transaction(async (tx) => {
      await tx.modifierOption.deleteMany({ where: { groupId: id } });
      return tx.modifierGroup.update({
        where: { id },
        data: {
          name,
          required,
          multiple,
          minSelect,
          maxSelect,
          options: {
            create: options.map((opt, idx) => ({
              name: opt.name.trim(),
              extraPrice: opt.extraPrice,
              isDefault: opt.isDefault,
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
