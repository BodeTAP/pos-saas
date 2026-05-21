import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getActiveOutletId } from "@/lib/active-outlet";
import { z } from "zod";
import { parseBody } from "@/lib/schemas";

const openShiftSchema = z.object({
  openingCash: z.number().nonnegative("Kas awal tidak boleh negatif.").default(0),
  note: z.string().max(300).optional(),
});

export async function GET(_req: NextRequest) {
  // Get current open shift for the cashier
  try {
    const session = await auth();
    if (!session?.user.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const outletId = await getActiveOutletId();

    const openShift = await prisma.cashierShift.findFirst({
      where: {
        cashierId: session.user.id,
        tenantId: session.user.tenantId,
        status: "OPEN",
        ...(outletId && { outletId }),
      },
      orderBy: { openedAt: "desc" },
    });

    return NextResponse.json({ shift: openShift });
  } catch (error) {
    console.error("Get shift error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // Open a new shift
  try {
    const session = await auth();
    if (!session?.user.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const outletId = await getActiveOutletId();
    if (!outletId) {
      return NextResponse.json({ error: "Cabang aktif tidak ditemukan." }, { status: 400 });
    }

    // Check if there's already an open shift
    const existingShift = await prisma.cashierShift.findFirst({
      where: {
        cashierId: session.user.id,
        tenantId: session.user.tenantId,
        outletId,
        status: "OPEN",
      },
    });

    if (existingShift) {
      return NextResponse.json(
        { error: "Anda sudah memiliki shift yang sedang berjalan.", shift: existingShift },
        { status: 409 }
      );
    }

    const parsed = await parseBody(req, openShiftSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }

    const shift = await prisma.cashierShift.create({
      data: {
        openingCash: parsed.data.openingCash,
        note: parsed.data.note,
        cashierId: session.user.id,
        outletId,
        tenantId: session.user.tenantId,
      },
    });

    return NextResponse.json({ shift }, { status: 201 });
  } catch (error) {
    console.error("Open shift error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
