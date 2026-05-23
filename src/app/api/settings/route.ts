import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { parseBody, settingsSchema } from "@/lib/schemas";
import { logAudit } from "@/lib/audit";

export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user.tenantId || session.user.role === "KASIR") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const parsed = await parseBody(req, settingsSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }

    const {
      name,
      phone,
      address,
      city,
      logoUrl,
      taxRate,
      receiptNote,
      receiptHeader,
      receiptWidth,
      invoicePrefix,
      pointsPerAmount,
      pointValue,
      activePaymentMethods,
    } = parsed.data;

    const tenant = await prisma.tenant.update({
      where: { id: session.user.tenantId },
      data: {
        name: name ?? undefined,
        phone: phone !== undefined ? phone : undefined,
        address: address !== undefined ? address : undefined,
        city: city !== undefined ? city : undefined,
        logoUrl: logoUrl !== undefined ? logoUrl : undefined,
        taxRate: taxRate !== undefined ? taxRate : undefined,
        receiptNote: receiptNote !== undefined ? receiptNote : undefined,
        receiptHeader: receiptHeader !== undefined ? receiptHeader : undefined,
        receiptWidth: receiptWidth ?? undefined,
        invoicePrefix: invoicePrefix
          ? invoicePrefix.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) || "INV"
          : undefined,
        pointsPerAmount: pointsPerAmount ?? undefined,
        pointValue: pointValue ?? undefined,
        activePaymentMethods: activePaymentMethods
          ? JSON.stringify(activePaymentMethods)
          : undefined,
      },
    });

    logAudit({
      action: "UPDATE",
      entity: "Settings",
      entityId: session.user.tenantId,
      entityName: tenant.name,
      userId: session.user.id,
      tenantId: session.user.tenantId,
    });

    return NextResponse.json({ tenant });
  } catch (error) {
    console.error("Settings update error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
