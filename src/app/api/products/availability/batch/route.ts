import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

const batchSchema = z.object({
  productIds: z.array(z.string().cuid()).min(1).max(500),
  availableToday: z.boolean(),
});

/**
 * PATCH /api/products/availability/batch
 * Update availableToday untuk banyak produk sekaligus.
 * Body: { productIds: string[], availableToday: boolean }
 */
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user.tenantId || session.user.role !== "OWNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const result = batchSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message ?? "Data tidak valid." },
        { status: 400 }
      );
    }

    const { productIds, availableToday } = result.data;

    // Update hanya produk milik tenant ini (defensive)
    const updated = await prisma.product.updateMany({
      where: {
        id: { in: productIds },
        tenantId: session.user.tenantId,
      },
      data: { availableToday },
    });

    return NextResponse.json({ updated: updated.count });
  } catch (error) {
    console.error("Batch availability update error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
