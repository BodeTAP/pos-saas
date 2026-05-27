import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * POST /api/modifiers/[id]/products
 * Assign modifier group ke daftar produk.
 * Body: { productIds: string[] }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user.tenantId || session.user.role !== "OWNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const group = await prisma.modifierGroup.findFirst({
      where: { id, tenantId: session.user.tenantId },
    });
    if (!group) {
      return NextResponse.json({ error: "Modifier group tidak ditemukan." }, { status: 404 });
    }

    const { productIds } = await req.json() as { productIds: string[] };
    if (!Array.isArray(productIds)) {
      return NextResponse.json({ error: "productIds harus berupa array." }, { status: 400 });
    }

    // Validasi produk milik tenant
    const ownedProducts = await prisma.product.findMany({
      where: { id: { in: productIds }, tenantId: session.user.tenantId },
      select: { id: true },
    });
    const validIds = ownedProducts.map((p) => p.id);

    // Upsert — skip yang sudah ada
    await prisma.$transaction(
      validIds.map((productId, idx) =>
        prisma.productModifierGroup.upsert({
          where: { productId_groupId: { productId, groupId: id } },
          create: { productId, groupId: id, position: idx },
          update: { position: idx },
        })
      )
    );

    return NextResponse.json({ success: true, assigned: validIds.length });
  } catch (error) {
    console.error("Assign modifier to products error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/modifiers/[id]/products
 * Hapus assignment modifier dari produk.
 * Body: { productIds: string[] }
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user.tenantId || session.user.role !== "OWNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { productIds } = await req.json() as { productIds: string[] };

    await prisma.productModifierGroup.deleteMany({
      where: { groupId: id, productId: { in: productIds } },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Remove modifier from products error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
