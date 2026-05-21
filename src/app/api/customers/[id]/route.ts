import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { parseBody, updateCustomerWithPointsSchema } from "@/lib/schemas";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const customer = await prisma.customer.findFirst({
      where: { id, tenantId: session.user.tenantId },
      include: {
        transactions: {
          where: { status: "COMPLETED" },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            invoiceNumber: true,
            total: true,
            createdAt: true,
          },
        },
      },
    });

    if (!customer) {
      return NextResponse.json({ error: "Pelanggan tidak ditemukan." }, { status: 404 });
    }

    return NextResponse.json({ customer });
  } catch (error) {
    console.error("Get customer error:", error);
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
    if (!session?.user.tenantId || session.user.role === "KASIR") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const existing = await prisma.customer.findFirst({
      where: { id, tenantId: session.user.tenantId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Pelanggan tidak ditemukan." }, { status: 404 });
    }

    const parsed = await parseBody(req, updateCustomerWithPointsSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }
    const { name, phone, email, points } = parsed.data;

    // Validasi phone unik kalau berubah
    if (phone && phone !== existing.phone) {
      const duplicate = await prisma.customer.findFirst({
        where: {
          tenantId: session.user.tenantId,
          phone,
          NOT: { id },
        },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: `Nomor ${phone} sudah dipakai pelanggan lain.` },
          { status: 409 }
        );
      }
    }

    const customer = await prisma.customer.update({
      where: { id },
      data: {
        name: name?.trim() ?? existing.name,
        phone: phone !== undefined ? phone || null : existing.phone,
        email: email !== undefined ? email || null : existing.email,
        points: points !== undefined ? points : existing.points,
      },
    });

    return NextResponse.json({ customer });
  } catch (error) {
    console.error("Update customer error:", error);
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
    if (!session?.user.tenantId || session.user.role !== "OWNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const existing = await prisma.customer.findFirst({
      where: { id, tenantId: session.user.tenantId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Pelanggan tidak ditemukan." }, { status: 404 });
    }

    await prisma.customer.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete customer error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
