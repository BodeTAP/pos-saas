import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

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

    const group = await prisma.modifierGroup.create({
      data: {
        name: name.trim(),
        required: required ?? false,
        multiple: multiple ?? false,
        minSelect: minSelect ?? 0,
        maxSelect: maxSelect ?? 1,
        tenantId: session.user.tenantId,
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

    return NextResponse.json({ group }, { status: 201 });
  } catch (error) {
    console.error("Create modifier error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
