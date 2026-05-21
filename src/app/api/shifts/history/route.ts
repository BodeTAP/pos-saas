import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const skip = (page - 1) * limit;

    // Owner can see all shifts, Kasir only their own
    const where =
      session.user.role === "OWNER"
        ? { tenantId: session.user.tenantId }
        : { cashierId: session.user.id, tenantId: session.user.tenantId };

    const [shifts, total] = await Promise.all([
      prisma.cashierShift.findMany({
        where,
        include: {
          cashier: { select: { name: true } },
          outlet: { select: { name: true } },
        },
        orderBy: { openedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.cashierShift.count({ where }),
    ]);

    return NextResponse.json({ shifts, total, page, limit });
  } catch (error) {
    console.error("Get shift history error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
