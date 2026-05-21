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
    const {
      name,
      phone,
      address,
      city,
      taxRate,
      receiptNote,
      receiptHeader,
      receiptWidth,
      invoicePrefix,
      pointsPerAmount,
      pointValue,
      activePaymentMethods,
    } = body;

    // Validasi metode pembayaran
    const validMethods = ["CASH", "QRIS", "TRANSFER", "CARD", "OTHER"];
    let parsedMethods: string[] = ["CASH", "QRIS", "TRANSFER"];
    if (activePaymentMethods) {
      try {
        const methods = typeof activePaymentMethods === "string"
          ? JSON.parse(activePaymentMethods)
          : activePaymentMethods;
        parsedMethods = (methods as string[]).filter((m) => validMethods.includes(m));
        if (parsedMethods.length === 0) parsedMethods = ["CASH"];
      } catch {
        parsedMethods = ["CASH", "QRIS", "TRANSFER"];
      }
    }

    const tenant = await prisma.tenant.update({
      where: { id: session.user.tenantId },
      data: {
        name: name || undefined,
        phone: phone || null,
        address: address || null,
        city: city || null,
        taxRate: taxRate !== undefined ? parseFloat(taxRate) || 0 : undefined,
        receiptNote: receiptNote || null,
        receiptHeader: receiptHeader || null,
        receiptWidth: receiptWidth !== undefined ? parseInt(receiptWidth) || 80 : undefined,
        invoicePrefix: invoicePrefix
          ? invoicePrefix.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) || "INV"
          : undefined,
        pointsPerAmount: pointsPerAmount !== undefined
          ? Math.max(1, parseInt(pointsPerAmount) || 10000)
          : undefined,
        pointValue: pointValue !== undefined
          ? Math.max(1, parseInt(pointValue) || 100)
          : undefined,
        activePaymentMethods: JSON.stringify(parsedMethods),
      },
    });

    return NextResponse.json({ tenant });
  } catch (error) {
    console.error("Settings update error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
