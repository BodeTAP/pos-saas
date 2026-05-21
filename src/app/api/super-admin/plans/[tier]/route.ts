import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { DEFAULT_PLANS, type PlanInfo } from "@/lib/plans";
import type { SubscriptionPlan } from "@prisma/client";

const VALID_TIERS: SubscriptionPlan[] = ["FREE", "PRO", "ENTERPRISE"];

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ tier: string }> }
) {
  try {
    const { tier: rawTier } = await params;
    const tier = rawTier.toUpperCase() as SubscriptionPlan;

    const session = await auth();
    if (session?.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!VALID_TIERS.includes(tier)) {
      return NextResponse.json({ error: "Tier tidak valid." }, { status: 400 });
    }

    const body = await req.json();
    const {
      name,
      description,
      monthlyPrice,
      yearlyPrice,
      maxProducts,
      maxCashiers,
      maxOutlets,
      features,
      isActive,
    } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Nama paket wajib diisi." }, { status: 400 });
    }

    const data = {
      name: name.trim(),
      description: description?.trim() || null,
      monthlyPrice: parseFloat(monthlyPrice) || 0,
      yearlyPrice: parseFloat(yearlyPrice) || 0,
      maxProducts: parseInt(maxProducts) || 1,
      maxCashiers: parseInt(maxCashiers) || 1,
      maxOutlets: parseInt(maxOutlets) || 1,
      features: Array.isArray(features) ? features : [],
      isActive: isActive ?? true,
    };

    // Upsert: kalau record belum ada, buat dengan default + override
    const plan = await prisma.pricingPlan.upsert({
      where: { tier },
      update: data,
      create: {
        tier,
        ...DEFAULT_PLANS[tier],
        ...data,
      },
    });

    const planInfo: PlanInfo = {
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

    return NextResponse.json({ plan: planInfo });
  } catch (error) {
    console.error("Update plan error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
