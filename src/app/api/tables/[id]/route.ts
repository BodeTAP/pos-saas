import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { parseBody } from "@/lib/schemas";
import { getActiveOutletId } from "@/lib/active-outlet";

const updateTableSchema = z.object({
  number: z.string().min(1).max(20).optional(),
  name: z.string().max(50).optional().nullable(),
  capacity: z.number().int().positive().optional(),
  area: z.string().max(50).optional().nullable(),
  status: z.enum(["EMPTY", "OCCUPIED", "BILL", "RESERVED"]).optional(),
  isActive: z.boolean().optional(),
});

/**
 * PUT /api/tables/[id]
 * Update meja (info atau status). OWNER untuk info, semua role untuk status.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const outletId = await getActiveOutletId();
    const table = await prisma.table.findFirst({
      where: {
        id,
        tenantId: session.user.tenantId,
        ...(outletId ? { outletId } : {}),
      },
    });
    if (!table) {
      return NextResponse.json({ error: "Meja tidak ditemukan." }, { status: 404 });
    }

    const parsed = await parseBody(req, updateTableSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }

    const { number, name, capacity, area, status, isActive } = parsed.data;

    // Kasir hanya boleh update status
    if (session.user.role === "KASIR") {
      if (number !== undefined || name !== undefined || capacity !== undefined ||
          area !== undefined || isActive !== undefined) {
        return NextResponse.json({ error: "Kasir hanya bisa update status meja." }, { status: 403 });
      }
    }

    // Cek nomor unik jika berubah
    if (number && number !== table.number) {
      const duplicate = await prisma.table.findFirst({
        where: { number, outletId: table.outletId, tenantId: session.user.tenantId, NOT: { id } },
        select: { id: true },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: `Nomor meja "${number}" sudah ada.` },
          { status: 409 }
        );
      }
    }

    const updated = await prisma.table.update({
      where: { id },
      data: {
        ...(number !== undefined && { number }),
        ...(name !== undefined && { name }),
        ...(capacity !== undefined && { capacity }),
        ...(area !== undefined && { area }),
        ...(status !== undefined && { status }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json({ table: updated });
  } catch (error) {
    console.error("Update table error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/tables/[id]
 * Soft delete meja. OWNER only.
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

    const outletId = await getActiveOutletId();
    const table = await prisma.table.findFirst({
      where: {
        id,
        tenantId: session.user.tenantId,
        ...(outletId ? { outletId } : {}),
      },
      include: { tableOrders: { where: { closedAt: null }, take: 1 } },
    });
    if (!table) {
      return NextResponse.json({ error: "Meja tidak ditemukan." }, { status: 404 });
    }

    if (table.tableOrders.length > 0) {
      return NextResponse.json(
        { error: "Meja masih memiliki order aktif. Selesaikan order terlebih dahulu." },
        { status: 400 }
      );
    }

    await prisma.table.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete table error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
