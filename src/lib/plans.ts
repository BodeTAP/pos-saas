import { prisma } from "@/lib/prisma";
import type { SubscriptionPlan } from "@prisma/client";

export type UpgradablePlan = "PRO" | "ENTERPRISE";

export interface PlanInfo {
  tier: SubscriptionPlan;
  name: string;
  description: string | null;
  monthlyPrice: number;
  yearlyPrice: number;
  maxProducts: number;
  maxCashiers: number;
  maxOutlets: number;
  features: string[];
  isActive: boolean;
}

/**
 * Hitung persentase hemat tahunan vs bulanan.
 * Contoh: bulanan Rp 149.000 × 12 = Rp 1.788.000, tahunan Rp 1.490.000
 * → hemat (1.788.000 - 1.490.000) / 1.788.000 × 100 ≈ 17%
 * Return 0 jika salah satu harga 0 atau tahunan lebih mahal dari bulanan×12.
 */
export function calcYearlyDiscountPct(monthlyPrice: number, yearlyPrice: number): number {
  if (monthlyPrice <= 0 || yearlyPrice <= 0) return 0;
  const annualEquivalent = monthlyPrice * 12;
  if (yearlyPrice >= annualEquivalent) return 0;
  return Math.round(((annualEquivalent - yearlyPrice) / annualEquivalent) * 100);
}

/**
 * Default values untuk seed/fallback awal — dipakai saat database
 * belum ada record (initial setup) atau saat fallback
 */
export const DEFAULT_PLANS: Record<SubscriptionPlan, Omit<PlanInfo, "tier">> = {
  FREE: {
    name: "Paket Gratis",
    description: "Cocok untuk toko kecil yang baru memulai",
    monthlyPrice: 0,
    yearlyPrice: 0,
    maxProducts: 50,
    maxCashiers: 1,
    maxOutlets: 1,
    features: ["50 produk", "1 kasir", "Laporan dasar"],
    isActive: true,
  },
  PRO: {
    name: "Paket Pro",
    description: "Untuk UMKM yang ingin berkembang",
    monthlyPrice: 149000,
    yearlyPrice: 1490000,
    maxProducts: 9999,
    maxCashiers: 5,
    maxOutlets: 1,
    features: [
      "Produk unlimited",
      "5 kasir",
      "Laporan lengkap + ekspor Excel/CSV",
      "Grafik analitik interaktif",
      "Prioritas support",
    ],
    isActive: true,
  },
  ENTERPRISE: {
    name: "Paket Enterprise",
    description: "Solusi lengkap untuk bisnis dengan multi-cabang",
    monthlyPrice: 499000,
    yearlyPrice: 4990000,
    maxProducts: 99999,
    maxCashiers: 99,
    maxOutlets: 99,
    features: [
      "Semua fitur Pro",
      "Kasir unlimited",
      "Multi-cabang (multiple outlets)",
      "Dedicated support",
    ],
    isActive: true,
  },
};

/**
 * Ambil 1 plan dari database. Kalau tidak ada record, fallback ke default.
 */
export async function getPlan(tier: SubscriptionPlan): Promise<PlanInfo> {
  const plan = await prisma.pricingPlan.findUnique({ where: { tier } });
  if (!plan) {
    return { tier, ...DEFAULT_PLANS[tier] };
  }
  return {
    tier: plan.tier,
    name: plan.name,
    description: plan.description,
    monthlyPrice: plan.monthlyPrice,
    yearlyPrice: plan.yearlyPrice,
    maxProducts: plan.maxProducts,
    maxCashiers: plan.maxCashiers,
    maxOutlets: plan.maxOutlets,
    features: plan.features,
    isActive: plan.isActive,
  };
}

/**
 * Ambil semua plan dari database (urut FREE → PRO → ENTERPRISE).
 * Satu query findMany, bukan 3 query sequential.
 */
export async function getAllPlans(): Promise<PlanInfo[]> {
  const tiers: SubscriptionPlan[] = ["FREE", "PRO", "ENTERPRISE"];

  const dbPlans = await prisma.pricingPlan.findMany({
    where: { tier: { in: tiers } },
  });

  const dbByTier = Object.fromEntries(dbPlans.map((p) => [p.tier, p]));

  return tiers.map((tier) => {
    const plan = dbByTier[tier];
    if (!plan) return { tier, ...DEFAULT_PLANS[tier] };
    return {
      tier: plan.tier,
      name: plan.name,
      description: plan.description,
      monthlyPrice: plan.monthlyPrice,
      yearlyPrice: plan.yearlyPrice,
      maxProducts: plan.maxProducts,
      maxCashiers: plan.maxCashiers,
      maxOutlets: plan.maxOutlets,
      features: plan.features,
      isActive: plan.isActive,
    };
  });
}

/**
 * Ambil daftar paket yang bisa di-upgrade (PRO & ENTERPRISE)
 * Hanya yang isActive = true
 */
export async function getUpgradablePlans(): Promise<PlanInfo[]> {
  const all = await getAllPlans();
  return all.filter(
    (p) => p.tier !== "FREE" && p.isActive
  );
}
