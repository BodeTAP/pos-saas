import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { parseBody } from "@/lib/schemas";
import { z } from "zod";

const updatePOSchema = z.object({
  supplierName: z.string().max(100).optional().nullable(),
  supplierPhone: z.string().max(20).optional().nullable(),
  note: z.string().max(500).optional().nullable(),
  // BUG 14: validate expectedDate is a real date string
  expectedDate: z
    .string()
    .optional()
    .nullable()
    .refine((v) => !v || !isNaN(Date.parse(v)), "Format tanggal tidak valid."),
  status: z.enum(["DRAFT", "ORDERED", "CANCELLED"]).optional(),
});

/**
 * GET /api/purchase-orders/[id]
 * Detail satu PO
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user.tenantId || session.user.role !== "OWNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const order = await prisma.purchaseOrder.findFirst({
      where: { id, tenantId: session.user.tenantId },
      include: {
        outlet: { select: { id: true, name: true } },
        items: {
          include: {
            product: { select: { name: true, unit: true, buyPrice: true } },
          },
          orderBy: { productName: "asc" },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "PO tidak ditemukan." }, { status: 404 });
    }

    return NextResponse.json({ order });
  } catch (error) {
    console.error("Get PO error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/**
 * PUT /api/purchase-orders/[id]
 * Update PO (hanya DRAFT/ORDERED yang bisa diupdate)
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user.tenantId || session.user.role !== "OWNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const existing = await prisma.purchaseOrder.findFirst({
      where: { id, tenantId: session.user.tenantId },
      select: { id: true, status: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "PO tidak ditemukan." }, { status: 404 });
    }
    if (existing.status === "RECEIVED" || existing.status === "CANCELLED") {
      return NextResponse.json(
        { error: "PO yang sudah diterima atau dibatalkan tidak bisa diubah." },
        { status: 400 }
      );
    }

    const parsed = await parseBody(req, updatePOSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }

    const { supplierName, supplierPhone, note, expectedDate, status } = parsed.data;

    const order = await prisma.purchaseOrder.update({
      where: { id },
      data: {
        ...(supplierName !== undefined && { supplierName }),
        ...(supplierPhone !== undefined && { supplierPhone }),
        ...(note !== undefined && { note }),
        ...(expectedDate !== undefined && {
          expectedDate: expectedDate ? new Date(expectedDate) : null,
        }),
        ...(status && { status }),
      },
      include: {
        outlet: { select: { name: true } },
        items: { include: { product: { select: { name: true, unit: true } } } },
      },
    });

    return NextResponse.json({ order });
  } catch (error) {
    console.error("Update PO error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/purchase-orders/[id]
 * Batalkan PO (hanya DRAFT/ORDERED)
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

    const existing = await prisma.purchaseOrder.findFirst({
      where: { id, tenantId: session.user.tenantId },
      select: { id: true, status: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "PO tidak ditemukan." }, { status: 404 });
    }
    if (existing.status === "RECEIVED") {
      return NextResponse.json(
        { error: "PO yang sudah diterima tidak bisa dibatalkan." },
        { status: 400 }
      );
    }
    // BUG 7: block cancellation of PARTIAL POs to prevent stock inconsistency
    if (existing.status === "PARTIAL") {
      return NextResponse.json(
        {
          error:
            "PO yang sudah sebagian diterima tidak bisa dibatalkan. Hubungi admin untuk penyesuaian stok manual.",
        },
        { status: 400 }
      );
    }

    await prisma.purchaseOrder.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Cancel PO error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
