import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * PATCH /api/products/[id]/availability
 * Toggle availableToday untuk menu F&B.
 * Body: { availableToday: boolean }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user.tenantId || session.user.role !== "OWNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const product = await prisma.product.findFirst({
      where: { id, tenantId: session.user.tenantId },
    });
    if (!product) {
      return NextResponse.json({ error: "Produk tidak ditemukan." }, { status: 404 });
    }

    const body = await req.json();
    const availableToday =
      typeof body.availableToday === "boolean"
        ? body.availableToday
        : !product.availableToday; // toggle jika tidak dikirim

    const updated = await prisma.product.update({
      where: { id },
      data: { availableToday },
      select: { id: true, availableToday: true },
    });

    return NextResponse.json({ product: updated });
  } catch (error) {
    console.error("Toggle availability error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
