import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { getActiveOutletId } from "@/lib/active-outlet";

import { ReservationStatus } from "@prisma/client";

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

    // Validasi status enum
    const validStatuses: ReservationStatus[] = ["CONFIRMED", "SEATED", "COMPLETED", "CANCELLED", "NO_SHOW"];
    const statusValidated = statusFilter && validStatuses.includes(statusFilter as ReservationStatus)
      ? (statusFilter as ReservationStatus)
      : null;

    // Default: dari awal hari ini sampai 7 hari ke depan
    // Menggunakan local time server (asumsi server timezone = tenant timezone)
    const now = new Date();
    let from: Date;
    let to: Date;
    if (dateStr) {
      // Parse YYYY-MM-DD sebagai start-of-day di local timezone
      const [y, m, d] = dateStr.split("-").map(Number);
      if (!y || !m || !d) {
        return NextResponse.json({ error: "Format tanggal tidak valid (gunakan YYYY-MM-DD)." }, { status: 400 });
      }
      from = new Date(y, m - 1, d, 0, 0, 0, 0);
      to = new Date(y, m - 1, d, 23, 59, 59, 999);
    } else {
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      to = new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);
    }

    const reservations = await prisma.reservation.findMany({
      where: {
        tenantId: session.user.tenantId,
        reservedAt: { gte: from, lte: to },
        ...(statusValidated ? { status: statusValidated } : {}),
        ...(outletId ? { table: { outletId } } : {}),
      },
      include: {
        table: { select: { id: true, number: true, name: true, area: true, capacity: true } },
      },
      orderBy: { reservedAt: "asc" },
      take: 200, // limit untuk cegah unbounded query
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

    // Tolak reservasi di masa lalu (toleransi 5 menit untuk slow form submit)
    const minAllowed = new Date(Date.now() - 5 * 60 * 1000);
    if (reservedAt < minAllowed) {
      return NextResponse.json(
        { error: "Tanggal reservasi tidak boleh di masa lalu." },
        { status: 400 }
      );
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

    // Check conflict + create dalam satu transaksi (cegah race condition)
    const reservation = await prisma.$transaction(async (tx) => {
      // Cek konflik jadwal: ada reservasi CONFIRMED/SEATED yang overlap
      const endAt = new Date(reservedAt.getTime() + data.durationMin * 60 * 1000);
      const conflict = await tx.reservation.findFirst({
        where: {
          tableId: data.tableId,
          status: { in: ["CONFIRMED", "SEATED"] },
          reservedAt: {
            gte: new Date(reservedAt.getTime() - 12 * 60 * 60 * 1000),
            lte: endAt,
          },
        },
      });
      if (conflict) {
        const existingEnd = new Date(conflict.reservedAt.getTime() + conflict.durationMin * 60 * 1000);
        if (conflict.reservedAt < endAt && existingEnd > reservedAt) {
          throw new Error(`__CONFLICT__:${conflict.guestName}:${conflict.reservedAt.toISOString()}`);
        }
      }

      const created = await tx.reservation.create({
        data: {
          tableId: data.tableId,
          tenantId: session.user.tenantId!,
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

      // Set Table.status = RESERVED kalau ini reservasi terdekat (≤30 mnt)
      const minutesUntil = (reservedAt.getTime() - Date.now()) / 60000;
      if (minutesUntil <= 30) {
        const targetTable = await tx.table.findUnique({
          where: { id: data.tableId },
          select: { status: true },
        });
        if (targetTable?.status === "EMPTY") {
          await tx.table.update({
            where: { id: data.tableId },
            data: { status: "RESERVED" },
          });
        }
      }

      return created;
    }).catch((err) => {
      if (err instanceof Error && err.message.startsWith("__CONFLICT__:")) {
        const [, name, dateIso] = err.message.split(":");
        return { __error: `Meja sudah ada reservasi a/n ${name} pada ${new Date(dateIso).toLocaleString("id-ID")}.` };
      }
      throw err;
    });

    if ("__error" in reservation) {
      return NextResponse.json({ error: reservation.__error }, { status: 409 });
    }

    return NextResponse.json({ reservation }, { status: 201 });
  } catch (error) {
    console.error("Create reservation error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
