import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendLowStockEmail } from "@/lib/email";
import { auth } from "@/lib/auth";

/**
 * Kirim email low stock alert ke semua Owner yang punya produk di bawah minStock.
 * Dipanggil via cron job harian (atau manual dari Super Admin).
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user.role === "SUPER_ADMIN") {
    return sendLowStockNotifications();
  }

  const secret = req.headers.get("x-cron-secret");
  const validSecret = process.env.CRON_SECRET;
  if (!validSecret) {
    return NextResponse.json({ error: "CRON_SECRET belum dikonfigurasi." }, { status: 503 });
  }
  if (secret !== validSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return sendLowStockNotifications();
}

async function sendLowStockNotifications() {
  try {
    // Raw query: ambil produk yang stock <= minStock, join ke tenant & outlet
    const rows = await prisma.$queryRaw<
      {
        tenantId: string;
        outletId: string;
        outletName: string;
        tenantName: string;
        tenantEmail: string;
        productName: string;
        stock: number;
        minStock: number;
        unit: string;
      }[]
    >`
      SELECT
        os."tenantId",
        os."outletId",
        o.name AS "outletName",
        t.name AS "tenantName",
        t.email AS "tenantEmail",
        p.name AS "productName",
        os.stock,
        os."minStock",
        p.unit
      FROM outlet_stocks os
      JOIN outlets o ON o.id = os."outletId"
      JOIN tenants t ON t.id = os."tenantId"
      JOIN products p ON p.id = os."productId"
      WHERE os.stock <= os."minStock"
        AND p."isActive" = true
        AND t."subscriptionStatus" NOT IN ('SUSPENDED')
      ORDER BY os."tenantId", os."outletId", os.stock ASC
    `;

    if (rows.length === 0) {
      return NextResponse.json({ sent: 0, total: 0, message: "Tidak ada stok menipis." });
    }

    // Group by tenant + outlet
    const grouped = new Map<
      string,
      {
        tenantEmail: string;
        tenantName: string;
        outletName: string;
        products: { name: string; stock: number; minStock: number; unit: string }[];
      }
    >();

    for (const row of rows) {
      const key = `${row.tenantId}:${row.outletId}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          tenantEmail: row.tenantEmail,
          tenantName: row.tenantName,
          outletName: row.outletName,
          products: [],
        });
      }
      grouped.get(key)!.products.push({
        name: row.productName,
        stock: Number(row.stock),
        minStock: Number(row.minStock),
        unit: row.unit,
      });
    }

    let sent = 0;
    const errors: string[] = [];

    for (const group of grouped.values()) {
      const ok = await sendLowStockEmail({
        to: group.tenantEmail,
        ownerName: group.tenantName,
        storeName: group.tenantName,
        outletName: group.outletName,
        products: group.products,
      });
      if (ok) sent++;
      else errors.push(`${group.tenantEmail} (${group.outletName})`);
    }

    return NextResponse.json({
      sent,
      total: grouped.size,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Low stock notification error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
