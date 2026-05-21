import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getActiveOutletId } from "@/lib/active-outlet";

export const POINT_VALUE = 100; // default
export const POINT_PER_AMOUNT = 10000; // default

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      invoiceNumber,
      items,
      subtotal,
      discount,
      discountPct,
      tax,
      taxPct,
      total,
      amountPaid,
      change,
      paymentMethod,
      note,
      cashierId,
      tenantId,
      customerId,
      pointsRedeemed,
    } = body;

    if (session.user.tenantId !== tenantId && session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Resolve outlet aktif (tidak terima dari client untuk security)
    const outletId = await getActiveOutletId();
    if (!outletId) {
      return NextResponse.json(
        { error: "Cabang aktif tidak ditemukan. Hubungi admin toko." },
        { status: 400 }
      );
    }

    // Validasi customer milik tenant ini (jika ada)
    if (customerId) {
      const customer = await prisma.customer.findFirst({
        where: { id: customerId, tenantId },
        select: { id: true, points: true },
      });
      if (!customer) {
        return NextResponse.json(
          { error: "Pelanggan tidak valid." },
          { status: 400 }
        );
      }
      if (pointsRedeemed && pointsRedeemed > customer.points) {
        return NextResponse.json(
          { error: "Jumlah poin yang ditukar melebihi saldo pelanggan." },
          { status: 400 }
        );
      }
    }

    // Validasi stok per outlet sebelum transaksi
    for (const item of items) {
      const outletStock = await prisma.outletStock.findUnique({
        where: {
          outletId_productId: { outletId, productId: item.productId },
        },
      });
      if (!outletStock || outletStock.stock < item.quantity) {
        return NextResponse.json(
          {
            error: `Stok ${item.productName} di cabang ini tidak cukup (tersedia: ${outletStock?.stock || 0}).`,
          },
          { status: 400 }
        );
      }
    }

    // Ambil konfigurasi poin dari tenant
    const tenantConfig = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { pointsPerAmount: true },
    });
    const pointsPerAmount = tenantConfig?.pointsPerAmount || POINT_PER_AMOUNT;

    // Hitung poin yang didapat dari transaksi ini (berdasarkan total final)
    const earnedPoints = Math.floor(total / pointsPerAmount);

    const transaction = await prisma.$transaction(async (tx) => {
      // Buat transaksi utama (dengan outletId)
      const newTransaction = await tx.transaction.create({
        data: {
          invoiceNumber,
          status: "COMPLETED",
          paymentMethod,
          subtotal,
          discount,
          discountPct,
          tax,
          taxPct,
          total,
          amountPaid,
          change,
          note: note || null,
          tenantId,
          cashierId,
          customerId: customerId || null,
          outletId,
          items: {
            create: items.map(
              (item: {
                productId: string;
                productName: string;
                productSku?: string;
                quantity: number;
                unitPrice: number;
                discount: number;
                subtotal: number;
              }) => ({
                productId: item.productId,
                productName: item.productName,
                productSku: item.productSku || null,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                discount: item.discount,
                subtotal: item.subtotal,
              })
            ),
          },
        },
      });

      // Deduct dari OutletStock & catat mutasi per outlet
      for (const item of items) {
        const outletStock = await tx.outletStock.findUnique({
          where: {
            outletId_productId: { outletId, productId: item.productId },
          },
        });
        if (!outletStock) continue;

        const newStock = Math.max(0, outletStock.stock - item.quantity);

        await tx.outletStock.update({
          where: { id: outletStock.id },
          data: { stock: newStock },
        });

        await tx.stockMutation.create({
          data: {
            type: "SALE",
            quantity: -item.quantity,
            stockBefore: outletStock.stock,
            stockAfter: newStock,
            note: `Penjualan - ${invoiceNumber}`,
            tenantId,
            productId: item.productId,
            outletId,
          },
        });
      }

      // Update poin pelanggan
      if (customerId) {
        const pointsDelta = earnedPoints - (pointsRedeemed || 0);
        if (pointsDelta !== 0) {
          await tx.customer.update({
            where: { id: customerId },
            data: { points: { increment: pointsDelta } },
          });
        }
      }

      return newTransaction;
    });

    return NextResponse.json(
      { success: true, transaction, earnedPoints },
      { status: 201 }
    );
  } catch (error) {
    console.error("Transaction error:", error);
    return NextResponse.json(
      { error: "Gagal memproses transaksi." },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const outletId = searchParams.get("outletId"); // optional filter
    const skip = (page - 1) * limit;

    const where = {
      tenantId: session.user.tenantId,
      status: "COMPLETED" as const,
      ...(outletId && { outletId }),
    };

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          cashier: { select: { name: true } },
          customer: { select: { name: true } },
          outlet: { select: { name: true } },
          items: { include: { product: { select: { name: true } } } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.transaction.count({ where }),
    ]);

    return NextResponse.json({ transactions, total, page, limit });
  } catch (error) {
    console.error("Get transactions error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
