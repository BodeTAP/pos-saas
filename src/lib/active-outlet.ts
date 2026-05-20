import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Resolve outlet aktif dari session user.
 * - Kasir: pakai outletId yang di-assign saat create user (tidak bisa diganti)
 * - Owner: pakai outletId di token (bisa di-switch via API switch-outlet)
 * - Fallback: outlet utama tenant (isMain = true)
 *
 * Return null kalau session tidak ada atau bukan tenant user.
 */
export async function getActiveOutletId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user.tenantId) return null;

  // Kalau session sudah punya outletId, pakai itu
  if (session.user.outletId) {
    // Validasi outlet masih aktif & milik tenant
    const outlet = await prisma.outlet.findFirst({
      where: {
        id: session.user.outletId,
        tenantId: session.user.tenantId,
        isActive: true,
      },
      select: { id: true },
    });
    if (outlet) return outlet.id;
  }

  // Fallback: ambil outlet utama
  const main = await prisma.outlet.findFirst({
    where: {
      tenantId: session.user.tenantId,
      isMain: true,
      isActive: true,
    },
    select: { id: true },
  });
  return main?.id || null;
}

/**
 * Resolve outlet aktif beserta tenant info — versi lengkap untuk POS page
 */
export async function getActiveOutlet() {
  const session = await auth();
  if (!session?.user.tenantId) return null;

  const outletId = await getActiveOutletId();
  if (!outletId) return null;

  return prisma.outlet.findFirst({
    where: { id: outletId, tenantId: session.user.tenantId },
  });
}
