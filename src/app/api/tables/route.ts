import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getActiveOutletId } from "@/lib/active-outlet";
import { z } from "zod";
import { parseBody } from "@/lib/schemas";

const createTableSchema = z.object({
  number: z.string().min(1, "Nomor meja wajib diisi.").max(20),
  name: z.string().max(50).optional().nullable(),
  capacity: z.number().int().positive().default(4),
  area: z.string().max(50).optional().nullable(),
  outletId: z.string().cuid().optional(), // opsional, default ke outlet aktif
});

/**
 * GET /api/tables
 * Daftar meja dengan status real-time.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const outletIdParam = searchParams.get("outletId");

    // Resolve outlet
    let outletId = outletIdParam;
    if (!outletId) {
      outletId = await getActiveOutletId();
    }
    if (!outletId) {
      return NextResponse.json({ error: "Cabang tidak ditemukan." }, { status: 400 });
    }

    // Validasi outlet milik tenant
    const outlet = await prisma.outlet.findFirst({
      where: { id: outletId, tenantId: session.user.tenantId },
      select: { id: true },
    });
    if (!outlet) {
      return NextResponse.json({ error: "Cabang tidak valid." }, { status: 400 });
    }

    const tables = await prisma.table.findMany({
      where: { outletId, tenantId: session.user.tenantId, isActive: true },
      include: {
        tableOrders: {
          where: { closedAt: null }, // order aktif
          select: { id: true, openedAt: true, note: true },
          take: 1,
        },
      },
      orderBy: [{ area: "asc" }, { number: "asc" }],
    });

    return NextResponse.json({ tables });
  } catch (error) {
    console.error("Get tables error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/**
 * POST /api/tables
 * Buat meja baru. OWNER only.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user.tenantId || session.user.role !== "OWNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const parsed = await parseBody(req, createTableSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }

    const { number, name, capacity, area, outletId: bodyOutletId } = parsed.data;

    // Resolve outlet
    const outletId = bodyOutletId || await getActiveOutletId();
    if (!outletId) {
      return NextResponse.json({ error: "Cabang tidak ditemukan." }, { status: 400 });
    }

    // Validasi outlet milik tenant
    const outlet = await prisma.outlet.findFirst({
      where: { id: outletId, tenantId: session.user.tenantId, isActive: true },
      select: { id: true },
    });
    if (!outlet) {
      return NextResponse.json({ error: "Cabang tidak valid." }, { status: 400 });
    }

    // Cek nomor meja unik per outlet
    const existing = await prisma.table.findFirst({
      where: { number, outletId, tenantId: session.user.tenantId },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: `Nomor meja "${number}" sudah ada di cabang ini.` },
        { status: 409 }
      );
    }

    const table = await prisma.table.create({
      data: {
        number,
        name: name || null,
        capacity: capacity ?? 4,
        area: area || null,
        outletId,
        tenantId: session.user.tenantId,
      },
    });

    return NextResponse.json({ table }, { status: 201 });
  } catch (error) {
    console.error("Create table error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
