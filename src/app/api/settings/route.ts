import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user.tenantId || session.user.role === "KASIR") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { name, phone, address, city, taxRate, receiptNote, receiptWidth } = body;

    const tenant = await prisma.tenant.update({
      where: { id: session.user.tenantId },
      data: {
        name: name || undefined,
        phone: phone || null,
        address: address || null,
        city: city || null,
        taxRate: taxRate !== undefined ? taxRate : undefined,
        receiptNote: receiptNote || null,
        receiptWidth: receiptWidth || undefined,
      },
    });

    return NextResponse.json({ tenant });
  } catch (error) {
    console.error("Settings update error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
