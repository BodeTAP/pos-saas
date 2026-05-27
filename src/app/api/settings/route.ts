import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { parseBody, settingsSchema } from "@/lib/schemas";
import { logAudit, diffObjects } from "@/lib/audit";

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

    // Ambil data sebelum update untuk diff
    const beforeTenant = await prisma.tenant.findUnique({
      where: { id: session.user.tenantId },
      select: {
        name: true, phone: true, address: true, city: true,
        taxRate: true, receiptNote: true, receiptHeader: true,
        receiptWidth: true, invoicePrefix: true,
        pointsPerAmount: true, pointValue: true, activePaymentMethods: true,
        serviceChargePct: true, paymentFlow: true,
      },
    });

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
        serviceChargePct: parsed.data.serviceChargePct ?? undefined,
        paymentFlow: parsed.data.paymentFlow ?? undefined,
      },
    });

    const afterData = {
      name: tenant.name, phone: tenant.phone, address: tenant.address, city: tenant.city,
      taxRate: tenant.taxRate, receiptNote: tenant.receiptNote, receiptHeader: tenant.receiptHeader,
      receiptWidth: tenant.receiptWidth, invoicePrefix: tenant.invoicePrefix,
      pointsPerAmount: tenant.pointsPerAmount, pointValue: tenant.pointValue,
      activePaymentMethods: tenant.activePaymentMethods,
      serviceChargePct: tenant.serviceChargePct,
      paymentFlow: tenant.paymentFlow,
    };

    const diff = beforeTenant
      ? diffObjects(
          beforeTenant as unknown as Record<string, unknown>,
          afterData as unknown as Record<string, unknown>
        )
      : null;

    logAudit({
      action: "UPDATE",
      entity: "Settings",
      entityId: session.user.tenantId,
      entityName: tenant.name,
      changes: diff ?? undefined,
      userId: session.user.id,
      tenantId: session.user.tenantId,
    });

    return NextResponse.json({ tenant });
  } catch (error) {
    console.error("Settings update error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
