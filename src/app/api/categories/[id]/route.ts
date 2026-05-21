import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user.tenantId || session.user.role === "KASIR") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const existing = await prisma.category.findFirst({
      where: { id, tenantId: session.user.tenantId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Kategori tidak ditemukan." }, { status: 404 });
    }
    const body = await req.json();
    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json({ error: "Nama kategori wajib diisi." }, { status: 400 });
    }
    // Cek duplikat nama (kecuali dirinya sendiri)
    const duplicate = await prisma.category.findFirst({
      where: {
        tenantId: session.user.tenantId,
        name: { equals: name, mode: "insensitive" },
        NOT: { id },
      },
    });
    if (duplicate) {
      return NextResponse.json({ error: `Kategori "${name}" sudah ada.` }, { status: 409 });
    }
    const category = await prisma.category.update({
      where: { id },
      data: { name },
      include: { _count: { select: { products: true } } },
    });
    return NextResponse.json({ category });
  } catch (error) {
    console.error("Update category error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user.tenantId || session.user.role === "KASIR") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const existing = await prisma.category.findFirst({
      where: { id, tenantId: session.user.tenantId },
      include: { _count: { select: { products: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Kategori tidak ditemukan." }, { status: 404 });
    }
    if (existing._count.products > 0) {
      return NextResponse.json(
        { error: `Kategori ini masih dipakai oleh ${existing._count.products} produk. Pindahkan produk terlebih dahulu.` },
        { status: 400 }
      );
    }
    await prisma.category.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete category error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
