import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const outlets = await prisma.outlet.findMany({
      where: { tenantId: session.user.tenantId },
      include: {
        _count: { select: { users: true, transactions: true } },
      },
      orderBy: [{ isMain: "desc" }, { createdAt: "asc" }],
    });

    return NextResponse.json({ outlets });
  } catch (error) {
    console.error("Get outlets error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user.tenantId || session.user.role !== "OWNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { name, address, phone } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Nama cabang wajib diisi." },
        { status: 400 }
      );
    }

    // Cek limit cabang berdasarkan plan
    const tenant = await prisma.tenant.findUnique({
      where: { id: session.user.tenantId },
      select: { maxOutlets: true, plan: true },
    });

    if (tenant) {
      const outletCount = await prisma.outlet.count({
        where: { tenantId: session.user.tenantId },
      });
      if (outletCount >= tenant.maxOutlets) {
        return NextResponse.json(
          {
            error: `Batas cabang paket ${tenant.plan} (${tenant.maxOutlets} cabang) telah tercapai. Upgrade ke Enterprise untuk multi-cabang.`,
          },
          { status: 403 }
        );
      }
    }

    const outlet = await prisma.$transaction(async (tx) => {
      const newOutlet = await tx.outlet.create({
        data: {
          name: name.trim(),
          address: address || null,
          phone: phone || null,
          isMain: false,
          isActive: true,
          tenantId: session.user.tenantId!,
        },
      });

      // Auto-create OutletStock untuk semua produk existing dengan stock = 0
      // (Owner perlu transfer/restok manual setelah cabang dibuat)
      const products = await tx.product.findMany({
        where: { tenantId: session.user.tenantId!, isActive: true },
        select: { id: true, minStock: true },
      });

      if (products.length > 0) {
        await tx.outletStock.createMany({
          data: products.map((p) => ({
            outletId: newOutlet.id,
            productId: p.id,
            tenantId: session.user.tenantId!,
            stock: 0,
            minStock: p.minStock,
          })),
        });
      }

      return newOutlet;
    });

    logAudit({
      action: "CREATE",
      entity: "Outlet",
      entityId: outlet.id,
      entityName: outlet.name,
      userId: session.user.id,
      tenantId: session.user.tenantId!,
    });

    return NextResponse.json({ outlet }, { status: 201 });
  } catch (error) {
    console.error("Create outlet error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
