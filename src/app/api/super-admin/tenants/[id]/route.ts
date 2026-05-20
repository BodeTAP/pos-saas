import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import type { Prisma } from "@prisma/client";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (session?.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            products: true,
            transactions: true,
            customers: true,
            outlets: true,
          },
        },
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            createdAt: true,
          },
          orderBy: { createdAt: "asc" },
        },
        outlets: {
          select: {
            id: true,
            name: true,
            isMain: true,
            isActive: true,
          },
        },
        billingInvoices: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Tenant tidak ditemukan." }, { status: 404 });
    }

    // Hitung total pendapatan tenant
    const revenue = await prisma.transaction.aggregate({
      where: { tenantId: id, status: "COMPLETED" },
      _sum: { total: true },
    });

    return NextResponse.json({
      tenant,
      totalRevenue: revenue._sum.total || 0,
    });
  } catch (error) {
    console.error("Get tenant error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (session?.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const existing = await prisma.tenant.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Tenant tidak ditemukan." }, { status: 404 });
    }

    const body = await req.json();
    const {
      plan,
      subscriptionStatus,
      subscriptionEndsAt,
      maxProducts,
      maxCashiers,
      maxOutlets,
    } = body;

    const updateData: Prisma.TenantUpdateInput = {};

    if (plan !== undefined) updateData.plan = plan as Prisma.EnumSubscriptionPlanFieldUpdateOperationsInput["set"];
    if (subscriptionStatus !== undefined) {
      updateData.subscriptionStatus = subscriptionStatus as Prisma.EnumSubscriptionStatusFieldUpdateOperationsInput["set"];
    }
    if (subscriptionEndsAt !== undefined) {
      updateData.subscriptionEndsAt = subscriptionEndsAt
        ? new Date(subscriptionEndsAt)
        : null;
    }
    if (maxProducts !== undefined) updateData.maxProducts = maxProducts;
    if (maxCashiers !== undefined) updateData.maxCashiers = maxCashiers;
    if (maxOutlets !== undefined) updateData.maxOutlets = maxOutlets;

    const tenant = await prisma.tenant.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ tenant });
  } catch (error) {
    console.error("Update tenant error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
