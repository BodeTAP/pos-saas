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
  .refine(
    (data) => !data.multiple || data.maxSelect >= 1,
    {
      message: "Group multi-pilih harus punya maxSelect minimal 1.",
      path: ["maxSelect"],
    }
  )
  .refine(
    (data) => data.multiple || data.maxSelect === 1,
    {
      message: "Group single-pilih harus punya maxSelect = 1.",
      path: ["maxSelect"],
    }
  )
  .refine(
    (data) => {
      const defaultCount = data.options.filter((o) => o.isDefault).length;
      // Single select: maks 1 default
      if (!data.multiple && defaultCount > 1) return false;
      // Multiple: defaultCount <= maxSelect
      if (data.multiple && defaultCount > data.maxSelect) return false;
      return true;
    },
    {
      message: "Jumlah opsi default melebihi batas (single ≤ 1, multiple ≤ maxSelect).",
      path: ["options"],
    }
  );

/**
 * GET /api/modifiers
 * Ambil semua modifier groups milik tenant (beserta options).
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user.tenantId || session.user.role !== "OWNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const groups = await prisma.modifierGroup.findMany({
      where: { tenantId: session.user.tenantId },
      include: {
        options: { orderBy: { position: "asc" } },
        _count: { select: { products: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ groups });
  } catch (error) {
    console.error("Get modifiers error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/**
 * POST /api/modifiers
 * Buat modifier group baru.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user.tenantId || session.user.role !== "OWNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

    const group = await prisma.modifierGroup.create({
      data: {
        name,
        required,
        multiple,
        minSelect,
        maxSelect,
        tenantId: session.user.tenantId,
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

    return NextResponse.json({ group }, { status: 201 });
  } catch (error) {
    console.error("Create modifier error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
