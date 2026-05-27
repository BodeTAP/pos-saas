import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { parseBody } from "@/lib/schemas";

const businessTypeSchema = z.object({
  businessType: z.enum(["RETAIL", "FNB", "SERVICE", "OTHER"], {
    errorMap: () => ({ message: "Tipe bisnis tidak valid." }),
  }),
});

/**
 * PUT /api/settings/business-type
 * Update tipe bisnis tenant. OWNER only.
 */
export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user.tenantId || session.user.role !== "OWNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const parsed = await parseBody(req, businessTypeSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }

    await prisma.tenant.update({
      where: { id: session.user.tenantId },
      data: { businessType: parsed.data.businessType },
    });

    return NextResponse.json({ success: true, businessType: parsed.data.businessType });
  } catch (error) {
    console.error("Update business type error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
