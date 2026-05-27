import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { NoTenant } from "@/components/ui/no-tenant";
import { getActiveOutletId } from "@/lib/active-outlet";
import { ReservationsClient } from "./reservations-client";

export default async function ReservationsPage() {
  const session = await auth();
  if (!session?.user.tenantId) return <NoTenant />;

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
    select: { businessType: true },
  });
  if (tenant?.businessType !== "FNB") redirect("/dashboard");

  const outletId = await getActiveOutletId();

  // Tampilkan reservasi mulai dari awal hari ini, 7 hari ke depan
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const to = new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [reservations, tables] = await Promise.all([
    prisma.reservation.findMany({
      where: {
        tenantId: session.user.tenantId,
        reservedAt: { gte: from, lte: to },
        ...(outletId ? { table: { outletId } } : {}),
      },
      include: {
        table: { select: { id: true, number: true, name: true, area: true, capacity: true } },
      },
      orderBy: { reservedAt: "asc" },
    }),
    prisma.table.findMany({
      where: {
        tenantId: session.user.tenantId,
        isActive: true,
        ...(outletId ? { outletId } : {}),
      },
      select: { id: true, number: true, name: true, area: true, capacity: true },
      orderBy: [{ area: "asc" }, { number: "asc" }],
    }),
  ]);

  return (
    <ReservationsClient
      initialReservations={reservations.map((r) => ({
        ...r,
        reservedAt: r.reservedAt.toISOString(),
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      }))}
      tables={tables}
    />
  );
}
