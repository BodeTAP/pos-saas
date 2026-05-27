import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { ReservationStatus } from "@prisma/client";

const updateSchema = z.object({
  guestName: z.string().min(1).max(100).optional(),
  guestPhone: z.string().max(20).nullable().optional(),
  guestCount: z.number().int().min(1).max(50).optional(),
  reservedAt: z.string().datetime().optional(),
  durationMin: z.number().int().min(15).max(720).optional(),
  note: z.string().max(300).nullable().optional(),
  status: z.enum(["CONFIRMED", "SEATED", "COMPLETED", "CANCELLED", "NO_SHOW"]).optional(),
});

/**
 * GET /api/reservations/[id]
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const reservation = await prisma.reservation.findFirst({
      where: { id, tenantId: session.user.tenantId },
      include: {
        table: { select: { id: true, number: true, name: true, area: true, capacity: true, status: true } },
      },
    });
    if (!reservation) {
      return NextResponse.json({ error: "Reservasi tidak ditemukan." }, { status: 404 });
    }
    return NextResponse.json({ reservation });
  } catch (error) {
    console.error("Get reservation error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/reservations/[id]
 * Update detail atau status reservasi.
 *
 * Side effects per status:
 * - SEATED: tandai meja status RESERVED → OCCUPIED (kalau lagi RESERVED)
 * - COMPLETED/CANCELLED/NO_SHOW: kalau meja masih RESERVED, balikkan ke EMPTY
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
    const existing = await prisma.reservation.findFirst({
      where: { id, tenantId: session.user.tenantId },
      include: { table: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Reservasi tidak ditemukan." }, { status: 404 });
    }

    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Data tidak valid." },
        { status: 400 }
      );
    }
    const data = parsed.data;

    // Validasi state machine
    // Allowed transitions:
    //   CONFIRMED → SEATED, CANCELLED, NO_SHOW
    //   SEATED    → COMPLETED, CANCELLED
    //   COMPLETED, CANCELLED, NO_SHOW = terminal (no further changes)
    if (data.status && data.status !== existing.status) {
      const allowed: Record<typeof existing.status, ReservationStatus[]> = {
        CONFIRMED: ["SEATED", "CANCELLED", "NO_SHOW"],
        SEATED: ["COMPLETED", "CANCELLED"],
        COMPLETED: [],
        CANCELLED: [],
        NO_SHOW: [],
      };
      if (!allowed[existing.status].includes(data.status as ReservationStatus)) {
        return NextResponse.json(
          { error: `Tidak bisa ubah status dari ${existing.status} ke ${data.status}.` },
          { status: 400 }
        );
      }
    }

    const updateData: Record<string, unknown> = { ...data };
    if (data.reservedAt) updateData.reservedAt = new Date(data.reservedAt);

    // Re-validate kapasitas kalau guestCount berubah
    if (data.guestCount && data.guestCount > existing.table.capacity) {
      return NextResponse.json(
        { error: `Kapasitas meja hanya ${existing.table.capacity} orang.` },
        { status: 400 }
      );
    }

    const reservation = await prisma.$transaction(async (tx) => {
      const updated = await tx.reservation.update({
        where: { id },
        data: updateData,
        include: {
          table: { select: { id: true, number: true, name: true, area: true, capacity: true, status: true } },
        },
      });

      // Side effect: sync status meja
      const newStatus = data.status as ReservationStatus | undefined;
      if (newStatus === "SEATED" && existing.table.status === "RESERVED") {
        await tx.table.update({ where: { id: existing.tableId }, data: { status: "OCCUPIED" } });
      } else if (
        (newStatus === "COMPLETED" || newStatus === "CANCELLED" || newStatus === "NO_SHOW") &&
        existing.table.status === "RESERVED"
      ) {
        await tx.table.update({ where: { id: existing.tableId }, data: { status: "EMPTY" } });
      }

      return updated;
    });

    return NextResponse.json({ reservation });
  } catch (error) {
    console.error("Update reservation error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/reservations/[id]
 * Hapus reservasi (soft delete via status CANCELLED juga bisa).
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const existing = await prisma.reservation.findFirst({
      where: { id, tenantId: session.user.tenantId },
      include: { table: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Reservasi tidak ditemukan." }, { status: 404 });
    }

    // Kalau meja masih RESERVED karena reservasi ini, balikkan ke EMPTY
    await prisma.$transaction(async (tx) => {
      await tx.reservation.delete({ where: { id } });
      if (existing.table.status === "RESERVED") {
        const otherActive = await tx.reservation.findFirst({
          where: {
            tableId: existing.tableId,
            status: { in: ["CONFIRMED", "SEATED"] },
          },
        });
        if (!otherActive) {
          await tx.table.update({ where: { id: existing.tableId }, data: { status: "EMPTY" } });
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete reservation error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
