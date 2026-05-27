import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { getActiveOutletId } from "@/lib/active-outlet";

const createSchema = z.object({
  tableId: z.string().cuid(),
  guestName: z.string().min(1).max(100),
  guestPhone: z.string().max(20).optional().nullable(),
  guestCount: z.number().int().min(1).max(50).default(2),
  reservedAt: z.string().datetime(),
  durationMin: z.number().int().min(15).max(720).default(120),
  note: z.string().max(300).optional().nullable(),
});

/**
 * GET /api/reservations
 * Query params:
 * - date=YYYY-MM-DD → reservasi pada tanggal tertentu (default: hari ini)
 * - status=CONFIRMED|SEATED|COMPLETED|CANCELLED|NO_SHOW
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const outletId = await getActiveOutletId();
    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get("date");
    const statusFilter = searchParams.get("status");

    // Default: dari awal hari ini sampai 7 hari ke depan
    const now = new Date();
    let from: Date;
    let to: Date;
    if (dateStr) {
      from = new Date(`${dateStr}T00:00:00`);
      to = new Date(`${dateStr}T23:59:59`);
    } else {
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      to = new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);
    }

    const reservations = await prisma.reservation.findMany({
      where: {
        tenantId: session.user.tenantId,
        reservedAt: { gte: from, lte: to },
        ...(statusFilter ? { status: statusFilter as never } : {}),
        ...(outletId ? { table: { outletId } } : {}),
      },
      include: {
        table: { select: { id: true, number: true, name: true, area: true, capacity: true } },
      },
      orderBy: { reservedAt: "asc" },
    });

    return NextResponse.json({ reservations });
  } catch (error) {
    console.error("Get reservations error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/**
 * POST /api/reservations
 * Buat reservasi baru. Status awal: CONFIRMED.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Data tidak valid." },
        { status: 400 }
      );
    }
    const data = parsed.data;
    const reservedAt = new Date(data.reservedAt);
    if (isNaN(reservedAt.getTime())) {
      return NextResponse.json({ error: "Tanggal reservasi tidak valid." }, { status: 400 });
    }

    const outletId = await getActiveOutletId();
    const table = await prisma.table.findFirst({
      where: {
        id: data.tableId,
        tenantId: session.user.tenantId,
        isActive: true,
        ...(outletId ? { outletId } : {}),
      },
      select: { id: true, capacity: true },
    });
    if (!table) {
      return NextResponse.json({ error: "Meja tidak ditemukan." }, { status: 404 });
    }
    if (data.guestCount > table.capacity) {
      return NextResponse.json(
        { error: `Kapasitas meja hanya ${table.capacity} orang.` },
        { status: 400 }
      );
    }

    // Cek konflik jadwal: ada reservasi CONFIRMED/SEATED yang overlap
    const endAt = new Date(reservedAt.getTime() + data.durationMin * 60 * 1000);
    const conflict = await prisma.reservation.findFirst({
      where: {
        tableId: data.tableId,
        status: { in: ["CONFIRMED", "SEATED"] },
        // Overlap: existing.start < new.end AND existing.end > new.start
        // Approximation: ambil reservasi yang start dalam window [now-12h, endAt]
        reservedAt: {
          gte: new Date(reservedAt.getTime() - 12 * 60 * 60 * 1000),
          lte: endAt,
        },
      },
    });
    if (conflict) {
      const existingEnd = new Date(conflict.reservedAt.getTime() + conflict.durationMin * 60 * 1000);
      // Cek overlap actual
      if (conflict.reservedAt < endAt && existingEnd > reservedAt) {
        return NextResponse.json(
          {
            error: `Meja sudah ada reservasi a/n ${conflict.guestName} pada ${conflict.reservedAt.toLocaleString("id-ID")}.`,
          },
          { status: 409 }
        );
      }
    }

    const reservation = await prisma.reservation.create({
      data: {
        tableId: data.tableId,
        tenantId: session.user.tenantId,
        guestName: data.guestName,
        guestPhone: data.guestPhone ?? null,
        guestCount: data.guestCount,
        reservedAt,
        durationMin: data.durationMin,
        note: data.note ?? null,
      },
      include: {
        table: { select: { id: true, number: true, name: true, area: true, capacity: true } },
      },
    });

    return NextResponse.json({ reservation }, { status: 201 });
  } catch (error) {
    console.error("Create reservation error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
