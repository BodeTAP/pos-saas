import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getActiveOutletId } from "@/lib/active-outlet";
import { parseBody, createTransactionSchema } from "@/lib/schemas";

export const POINT_VALUE = 100; // default
export const POINT_PER_AMOUNT = 10000; // default

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = await parseBody(req, createTransactionSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }

    const {
      invoiceNumber,
      items,
      discountPct,
      discountNominal,
      amountPaid,
      paymentMethod,
      note,
      customerId,
      pointsRedeemed,
      tenantId: bodyTenantId,
    } = parsed.data;
    const nominalDiscount = discountNominal ?? 0;
    const percentageDiscount = discountPct ?? 0;
    const redeemedPoints = pointsRedeemed ?? 0;

    // FIX 3: Derive tenantId and cashierId from session (not from body)
    const tenantId =
      session.user.role === "SUPER_ADMIN" && bodyTenantId
        ? bodyTenantId
        : session.user.tenantId!;
    const cashierId = session.user.id;

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

    if (redeemedPoints > 0 && !customerId) {
      return NextResponse.json(
        { error: "Pelanggan wajib dipilih untuk menukar poin." },
        { status: 400 }
      );
    }

    // Harga, pajak, poin, dan metode pembayaran adalah otoritas server.
    const tenantConfig = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        pointsPerAmount: true,
        pointValue: true,
        taxRate: true,
        activePaymentMethods: true,
      },
    });
    if (!tenantConfig) {
      return NextResponse.json({ error: "Tenant tidak ditemukan." }, { status: 404 });
    }

    const activePaymentMethods = (() => {
      try {
        const parsed = JSON.parse(tenantConfig.activePaymentMethods) as string[];
        return new Set(parsed);
      } catch {
        return new Set(["CASH", "QRIS", "TRANSFER"]);
      }
    })();
    if (!activePaymentMethods.has(paymentMethod)) {
      return NextResponse.json(
        { error: "Metode pembayaran tidak aktif untuk toko ini." },
        { status: 400 }
      );
    }

    // Validasi customer milik tenant ini (jika ada).
    const customer = customerId
      ? await prisma.customer.findFirst({
          where: { id: customerId, tenantId },
          select: { id: true, points: true },
        })
      : null;
    if (customerId && !customer) {
      return NextResponse.json({ error: "Pelanggan tidak valid." }, { status: 400 });
    }
    if (customer && redeemedPoints > customer.points) {
      return NextResponse.json(
        { error: "Jumlah poin yang ditukar melebihi saldo pelanggan." },
        { status: 400 }
      );
    }

    const pointsPerAmount = tenantConfig?.pointsPerAmount || POINT_PER_AMOUNT;
    const pointValue = tenantConfig?.pointValue || POINT_VALUE;

    // Validasi produk milik tenant dan ambil harga terbaru dari server.
    const productIds = [...new Set(items.map((item) => item.productId))];
    const ownedProducts = await prisma.product.findMany({
      where: { id: { in: productIds }, tenantId, isActive: true },
      select: { id: true, name: true, sku: true, sellPrice: true },
    });
    if (ownedProducts.length !== productIds.length) {
      return NextResponse.json(
        { error: "Satu atau lebih produk tidak valid." },
        { status: 400 }
      );
    }

    const productsById = new Map(ownedProducts.map((product) => [product.id, product]));
    const invalidDiscountItem = items.find((item) => {
      const product = productsById.get(item.productId)!;
      return (item.discount ?? 0) > product.sellPrice * item.quantity;
    });
    if (invalidDiscountItem) {
      const product = productsById.get(invalidDiscountItem.productId)!;
      return NextResponse.json(
        { error: `Diskon item ${product.name} melebihi subtotal item.` },
        { status: 400 }
      );
    }

    const transactionItems = items.map((item) => {
      const product = productsById.get(item.productId)!;
      const itemGross = product.sellPrice * item.quantity;
      const itemDiscount = item.discount ?? 0;

      return {
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        quantity: item.quantity,
        unitPrice: product.sellPrice,
        discount: itemDiscount,
        subtotal: itemGross - itemDiscount,
      };
    });

    const subtotal = transactionItems.reduce((sum, item) => sum + item.subtotal, 0);
    const transactionDiscount =
      nominalDiscount > 0
        ? Math.min(nominalDiscount, subtotal)
        : subtotal * (percentageDiscount / 100);
    const pointsDiscount = redeemedPoints * pointValue;
    const maxPointsDiscount = Math.max(0, subtotal - transactionDiscount);
    if (pointsDiscount > maxPointsDiscount) {
      return NextResponse.json(
        { error: "Jumlah poin yang ditukar melebihi total setelah diskon." },
        { status: 400 }
      );
    }

    const discountedSubtotal = Math.max(0, subtotal - transactionDiscount - pointsDiscount);
    const taxPct = tenantConfig.taxRate;
    const tax = discountedSubtotal * (taxPct / 100);
    const total = discountedSubtotal + tax;
    const finalAmountPaid = paymentMethod === "CASH" ? amountPaid : total;
    if (paymentMethod === "CASH" && finalAmountPaid < total) {
      return NextResponse.json(
        { error: "Uang diterima kurang dari total transaksi." },
        { status: 400 }
      );
    }
    const change = paymentMethod === "CASH" ? Math.max(0, finalAmountPaid - total) : 0;
    const discount = transactionDiscount + pointsDiscount;

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
          discountPct: percentageDiscount,
          tax,
          taxPct,
          total,
          amountPaid: finalAmountPaid,
          change,
          note: note || null,
          tenantId,
          cashierId,
          customerId: customerId || null,
          outletId,
          items: {
            create: transactionItems.map((item) => ({
                productId: item.productId,
                productName: item.productName,
                productSku: item.productSku || null,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                discount: item.discount ?? 0,
                subtotal: item.subtotal,
              })
            ),
          },
        },
        include: { items: true },
      });

      // FIX 1: Atomic stock deduction — fails if stock insufficient
      for (const item of transactionItems) {
        const updated = await tx.outletStock.updateMany({
          where: {
            outletId,
            productId: item.productId,
            stock: { gte: item.quantity },
          },
          data: { stock: { decrement: item.quantity } },
        });

        if (updated.count === 0) {
          throw new Error(`Stok ${item.productName} tidak cukup saat transaksi diproses.`);
        }

        // Get updated stock for mutation log
        const updatedStock = await tx.outletStock.findUnique({
          where: { outletId_productId: { outletId, productId: item.productId } },
          select: { stock: true },
        });
        const stockBefore = (updatedStock?.stock ?? 0) + item.quantity;
        const stockAfter = updatedStock?.stock ?? 0;

        await tx.stockMutation.create({
          data: {
            type: "SALE",
            quantity: -item.quantity,
            stockBefore,
            stockAfter,
            note: `Penjualan - ${invoiceNumber}`,
            tenantId,
            productId: item.productId,
            outletId,
          },
        });
      }

      // Update poin pelanggan
      if (customerId) {
        const pointsDelta = earnedPoints - redeemedPoints;
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
    const message =
      error instanceof Error ? error.message : "Gagal memproses transaksi.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user.tenantId || session.user.role !== "OWNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
