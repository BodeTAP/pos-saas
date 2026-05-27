import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { TableStatus } from "@prisma/client";
import { getActiveOutletId } from "@/lib/active-outlet";

/**
 * PATCH /api/tables/[id]/status
 * Update status meja (misal: OCCUPIED → BILL).
 * Body: { status: TableStatus }
 */
export async function PATCH(
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

    const { status } = await req.json() as { status: TableStatus };
    const validStatuses: TableStatus[] = ["EMPTY", "OCCUPIED", "BILL", "RESERVED"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "Status tidak valid." }, { status: 400 });
    }

    const updated = await prisma.table.update({
      where: { id },
      data: { status },
      select: { id: true, status: true, number: true },
    });

    return NextResponse.json({ table: updated });
  } catch (error) {
    console.error("Update table status error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
