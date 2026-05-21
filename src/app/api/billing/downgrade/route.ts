import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getPlan } from "@/lib/plans";
import { parseBody, downgradeSchema } from "@/lib/schemas";

/**
 * Jadwalkan downgrade paket (misal Enterprise → Pro).
 * Paket saat ini tetap aktif sampai subscriptionEndsAt.
 * Setelah berakhir, sistem akan menerapkan paket baru.
 *
 * Tidak memerlukan pembayaran — downgrade gratis, efektif saat renewal.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user.tenantId || session.user.role !== "OWNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const parsed = await parseBody(req, downgradeSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }
    const { plan } = parsed.data;

    const tenant = await prisma.tenant.findUnique({
      where: { id: session.user.tenantId },
      select: {
        plan: true,
        subscriptionStatus: true,
        subscriptionEndsAt: true,
        maxCashiers: true,
        maxOutlets: true,
      },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Tenant tidak ditemukan." }, { status: 404 });
    }

    // Validasi: hanya boleh downgrade ke paket lebih rendah
    const planOrder = { FREE: 0, PRO: 1, ENTERPRISE: 2 };
    const currentOrder = planOrder[tenant.plan as keyof typeof planOrder] ?? 0;
    const targetOrder = planOrder[plan as keyof typeof planOrder] ?? 0;

    if (targetOrder >= currentOrder) {
      return NextResponse.json(
        { error: "Gunakan fitur upgrade untuk pindah ke paket lebih tinggi." },
        { status: 400 }
      );
    }

    // Harus ada langganan aktif
    const isActive =
      tenant.subscriptionStatus === "ACTIVE" &&
      tenant.subscriptionEndsAt &&
      tenant.subscriptionEndsAt > new Date();

    if (!isActive) {
      return NextResponse.json(
        { error: "Tidak ada langganan aktif untuk dijadwalkan downgrade." },
        { status: 400 }
      );
    }

    // Cek dampak downgrade — apakah ada data yang akan terdampak
    const targetPlanInfo = await getPlan(plan as "PRO" | "ENTERPRISE");
    const warnings: string[] = [];

    if (plan === "PRO") {
      // Cek jumlah kasir aktif
      const activeCashiers = await prisma.user.count({
        where: {
          tenantId: session.user.tenantId,
          role: "KASIR",
          isActive: true,
        },
      });
      if (activeCashiers > targetPlanInfo.maxCashiers) {
        warnings.push(
          `Anda memiliki ${activeCashiers} kasir aktif. Paket Pro hanya mengizinkan ${targetPlanInfo.maxCashiers} kasir. Kasir ke-${targetPlanInfo.maxCashiers + 1} dst tidak bisa login setelah downgrade.`
        );
      }

      // Cek jumlah cabang aktif
      const activeOutlets = await prisma.outlet.count({
        where: { tenantId: session.user.tenantId, isActive: true },
      });
      if (activeOutlets > targetPlanInfo.maxOutlets) {
        warnings.push(
          `Anda memiliki ${activeOutlets} cabang aktif. Paket Pro hanya mengizinkan ${targetPlanInfo.maxOutlets} cabang. Cabang ke-${targetPlanInfo.maxOutlets + 1} dst tidak bisa digunakan setelah downgrade.`
        );
      }
    }

    // Simpan jadwal downgrade
    await prisma.tenant.update({
      where: { id: session.user.tenantId },
      data: {
        scheduledDowngradePlan: plan as "PRO" | "FREE",
      },
    });

    return NextResponse.json({
      success: true,
      scheduledPlan: plan,
      effectiveDate: tenant.subscriptionEndsAt,
      warnings,
    });
  } catch (error) {
    console.error("Downgrade error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal menjadwalkan downgrade." },
      { status: 500 }
    );
  }
}

/**
 * Batalkan downgrade yang sudah dijadwalkan
 */
export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user.tenantId || session.user.role !== "OWNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.tenant.update({
      where: { id: session.user.tenantId },
      data: { scheduledDowngradePlan: null },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Cancel downgrade error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
