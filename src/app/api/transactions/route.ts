import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getActiveOutletId } from "@/lib/active-outlet";
import { parseBody, createTransactionSchema } from "@/lib/schemas";
import { generateInvoiceNumber } from "@/lib/utils";
import { Prisma } from "@prisma/client";
import { createNotification, notifyLowStock } from "@/lib/notifications";

const POINT_VALUE = 100; // default
const POINT_PER_AMOUNT = 10000; // default
const MAX_INVOICE_ATTEMPTS = 3;

function isInvoiceNumberConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }

  const target = error.meta?.target;
  return Array.isArray(target)
    ? target.includes("invoiceNumber")
    : String(target).includes("invoiceNumber");
}

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
      items,
      discountPct,
      discountNominal,
      amountPaid,
      paymentMethod,
      note,
      customerId,
      pointsRedeemed,
      tenantId: bodyTenantId,
      tableOrderId: bodyTableOrderId,
      tableId: bodyTableId,
      serviceChargePct: bodyServiceChargePct,
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
    const activeOutletId = outletId;

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
        invoicePrefix: true,
        serviceChargePct: true,
        paymentFlow: true,
        businessType: true,
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
      select: { id: true, name: true, sku: true, sellPrice: true, buyPrice: true, hasVariants: true },
    });
    if (ownedProducts.length !== productIds.length) {
      return NextResponse.json(
        { error: "Satu atau lebih produk tidak valid." },
        { status: 400 }
      );
    }

    // Validasi variant SKUs jika ada
    const variantSkuIds = items
      .map((i) => i.variantSkuId)
      .filter(Boolean) as string[];

    const variantSkusById = new Map<string, { id: string; price: number; buyPrice: number; sku: string | null; productId: string }>();
    if (variantSkuIds.length > 0) {
      const variantSkus = await prisma.productVariantSKU.findMany({
        where: { id: { in: variantSkuIds }, productId: { in: productIds }, isActive: true },
        select: { id: true, price: true, buyPrice: true, sku: true, productId: true },
      });
      variantSkus.forEach((vs) => variantSkusById.set(vs.id, vs));
    }

    const productsById = new Map(ownedProducts.map((product) => [product.id, product]));
    const invalidDiscountItem = items.find((item) => {
      const product = productsById.get(item.productId)!;
      const variantSku = item.variantSkuId ? variantSkusById.get(item.variantSkuId) : null;
      const unitPrice = variantSku ? variantSku.price : product.sellPrice;
      return (item.discount ?? 0) > unitPrice * item.quantity;
    });
    if (invalidDiscountItem) {
      const product = productsById.get(invalidDiscountItem.productId)!;
      return NextResponse.json(
        { error: `Diskon item ${product.name} melebihi subtotal item.` },
        { status: 400 }
      );
    }

    // Ambil label varian untuk snapshot
    const variantLabels = new Map<string, string>();
    if (variantSkuIds.length > 0) {
      const skusWithOptions = await prisma.productVariantSKU.findMany({
        where: { id: { in: variantSkuIds } },
        include: {
          options: {
            include: { option: { include: { variantType: true } } },
          },
        },
      });
      skusWithOptions.forEach((sku) => {
        const label = sku.options
          .sort((a, b) => a.option.variantType.position - b.option.variantType.position)
          .map((o) => o.option.name)
          .join(" / ");
        variantLabels.set(sku.id, label);
      });
    }

    const transactionItems = items.map((item) => {
      const product = productsById.get(item.productId)!;
      const variantSku = item.variantSkuId ? variantSkusById.get(item.variantSkuId) : null;
      const baseUnitPrice = variantSku ? variantSku.price : product.sellPrice;
      // F&B: harga unit final = base + total extra modifier
      const modifierExtra = (item.modifiers ?? []).reduce((s, m) => s + (m.extraPrice ?? 0), 0);
      const unitPrice = baseUnitPrice + modifierExtra;
      const buyPrice = variantSku ? variantSku.buyPrice : product.buyPrice;
      const itemGross = unitPrice * item.quantity;
      const itemDiscount = item.discount ?? 0;

      return {
        productId: product.id,
        productName: product.name,
        productSku: variantSku?.sku ?? product.sku,
        quantity: item.quantity,
        unitPrice,
        buyPrice,
        discount: itemDiscount,
        subtotal: itemGross - itemDiscount,
        variantSkuId: item.variantSkuId ?? null,
        variantLabel: item.variantSkuId ? (variantLabels.get(item.variantSkuId) ?? null) : null,
        modifiers: item.modifiers ?? [],
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
    // Service charge dihitung dari subtotal setelah diskon (sebelum pajak)
    // Server otoritas — abaikan client input untuk security
    void bodyServiceChargePct; // disengaja tidak dipakai
    const serviceChargePct = tenantConfig.serviceChargePct ?? 0;
    const serviceCharge = discountedSubtotal * (serviceChargePct / 100);
    const taxPct = tenantConfig.taxRate;
    const tax = (discountedSubtotal + serviceCharge) * (taxPct / 100);
    const total = discountedSubtotal + serviceCharge + tax;
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

    async function createCompletedTransaction(invoiceNumber: string) {
      return prisma.$transaction(async (tx) => {
      // Buat transaksi utama (dengan outletId)
      const newTransaction = await tx.transaction.create({
        data: {
          invoiceNumber,
          status: "COMPLETED",
          paymentMethod,
          subtotal,
          discount,
          discountPct: percentageDiscount,
          serviceCharge,
          serviceChargePct,
          tax,
          taxPct,
          total,
          amountPaid: finalAmountPaid,
          change,
          pointsEarned: earnedPoints,
          pointsRedeemed: redeemedPoints,
          note: note || null,
          tenantId,
          cashierId,
          customerId: customerId || null,
          outletId: activeOutletId,
          tableOrderId: tableOrderId || null,
          items: {
            create: transactionItems.map((item) => ({
                productId: item.productId,
                productName: item.productName,
                productSku: item.productSku || null,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                buyPrice: item.buyPrice,
                discount: item.discount ?? 0,
                subtotal: item.subtotal,
                variantSkuId: item.variantSkuId || null,
                variantLabel: item.variantLabel || null,
                // F&B: snapshot modifiers
                modifiers: item.modifiers && item.modifiers.length > 0
                  ? {
                      create: item.modifiers.map((m) => ({
                        modifierGroupId: "", // group ID tidak tersimpan di payload (snapshot only)
                        modifierGroupName: m.groupName,
                        modifierOptionId: "",
                        modifierOptionName: m.optionName,
                        extraPrice: m.extraPrice,
                      })),
                    }
                  : undefined,
              })
            ),
          },
        },
        include: { items: true },
      });

      // FIX 1: Atomic stock deduction — fails if stock insufficient
      for (const item of transactionItems) {
        if (item.variantSkuId) {
          // Deduct dari OutletStockVariant
          const updated = await tx.outletStockVariant.updateMany({
            where: {
              outletId: activeOutletId,
              skuId: item.variantSkuId,
              stock: { gte: item.quantity },
            },
            data: { stock: { decrement: item.quantity } },
          });

          if (updated.count === 0) {
            throw new Error(`Stok ${item.productName} (${item.variantLabel}) tidak cukup saat transaksi diproses.`);
          }

          const updatedStock = await tx.outletStockVariant.findUnique({
            where: { outletId_skuId: { outletId: activeOutletId, skuId: item.variantSkuId } },
            select: { stock: true },
          });
          const stockBefore = (updatedStock?.stock ?? 0) + item.quantity;

          await tx.stockMutationVariant.create({
            data: {
              type: "SALE",
              quantity: -item.quantity,
              stockBefore,
              stockAfter: updatedStock?.stock ?? 0,
              note: `Penjualan - ${invoiceNumber}`,
              tenantId,
              skuId: item.variantSkuId,
              outletId: activeOutletId,
            },
          });
        } else {
          // Deduct dari OutletStock biasa
          const updated = await tx.outletStock.updateMany({
            where: {
              outletId: activeOutletId,
              productId: item.productId,
              stock: { gte: item.quantity },
            },
            data: { stock: { decrement: item.quantity } },
          });

          if (updated.count === 0) {
            throw new Error(`Stok ${item.productName} tidak cukup saat transaksi diproses.`);
          }

          const updatedStock = await tx.outletStock.findUnique({
            where: {
              outletId_productId: { outletId: activeOutletId, productId: item.productId },
            },
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
              outletId: activeOutletId,
            },
          });
        }
      }

      // Update poin pelanggan dan cek redeem secara atomik.
      if (customerId) {
        const pointsDelta = earnedPoints - redeemedPoints;
        if (pointsDelta !== 0 || redeemedPoints > 0) {
          const pointsUpdate = await tx.customer.updateMany({
            where: {
              id: customerId,
              tenantId,
              ...(redeemedPoints > 0 && { points: { gte: redeemedPoints } }),
            },
            data: { points: { increment: pointsDelta } },
          });
          if (pointsUpdate.count === 0) {
            throw new Error("INSUFFICIENT_POINTS");
          }
        }
      }

        return newTransaction;
      });
    }

    // F&B: tentukan flow berdasarkan paymentFlow tenant + ada/tidaknya meja
    const isFnB = tenantConfig.businessType === "FNB";
    const isPayFirst = isFnB && tenantConfig.paymentFlow === "PAY_FIRST";

    // F&B: lazy-create TableOrder kalau hanya tableId yang dikirim
    // (kasir pilih meja EMPTY → tidak ada side effect di DB sampai bayar/kirim ke dapur)
    let tableOrderId: string | null = bodyTableOrderId ?? null;
    let createdNewTableOrder = false; // untuk rollback kalau transaksi gagal
    if (!tableOrderId && bodyTableId && isFnB) {
      // Validasi meja milik tenant + outlet aktif
      const targetTable = await prisma.table.findFirst({
        where: {
          id: bodyTableId,
          tenantId,
          isActive: true,
          outletId: activeOutletId,
        },
        select: { id: true },
      });
      if (!targetTable) {
        return NextResponse.json(
          { error: "Meja tidak ditemukan atau bukan milik cabang ini." },
          { status: 400 }
        );
      }

      // Buat TableOrder baru (atomic dengan partial unique index)
      try {
        const newOrder = await prisma.$transaction(async (tx) => {
          const order = await tx.tableOrder.create({
            data: { tableId: bodyTableId, tenantId },
            select: { id: true },
          });
          await tx.table.update({
            where: { id: bodyTableId },
            data: { status: "OCCUPIED" },
          });
          return order;
        });
        tableOrderId = newOrder.id;
        createdNewTableOrder = true;
      } catch (err) {
        // P2002 = sudah ada active TableOrder (race condition dengan kasir lain)
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          const existing = await prisma.tableOrder.findFirst({
            where: { tableId: bodyTableId, tenantId, closedAt: null },
            select: { id: true, transactionId: true },
          });
          if (existing && !existing.transactionId) {
            tableOrderId = existing.id;
          } else if (existing?.transactionId) {
            return NextResponse.json(
              { error: "Meja ini sudah memiliki order yang dibayar. Refresh halaman dan coba lagi." },
              { status: 409 }
            );
          }
        } else {
          throw err;
        }
      }
    }

    // Validasi: jika ada tableOrderId, pastikan TableOrder belum dibayar
    let tableOrderHasItems = false;
    if (tableOrderId && !createdNewTableOrder) {
      const tableOrderInfo = await prisma.tableOrder.findFirst({
        where: { id: tableOrderId, tenantId, closedAt: null },
        select: { id: true, transactionId: true },
      });

      if (!tableOrderInfo) {
        return NextResponse.json(
          { error: "Order meja tidak ditemukan atau sudah ditutup." },
          { status: 404 }
        );
      }

      // Reject jika sudah ada transactionId (sudah dibayar)
      if (tableOrderInfo.transactionId) {
        return NextResponse.json(
          { error: "Order meja ini sudah dibayar sebelumnya. Tidak bisa bayar 2 kali." },
          { status: 409 }
        );
      }

      const existingCount = await prisma.orderItem.count({
        where: {
          tableOrderId,
          tenantId,
          status: { not: "CANCELLED" },
        },
      });
      tableOrderHasItems = existingCount > 0;
    }

    // Buat transaksi (dengan retry untuk invoice conflict)
    // Jika gagal, rollback TableOrder yang baru dibuat
    let transaction = null;
    try {
      for (let attempt = 0; attempt < MAX_INVOICE_ATTEMPTS; attempt++) {
        const invoiceNumber = generateInvoiceNumber(tenantConfig.invoicePrefix || "INV");
        try {
          transaction = await createCompletedTransaction(invoiceNumber);
          break;
        } catch (error) {
          if (!isInvoiceNumberConflict(error) || attempt === MAX_INVOICE_ATTEMPTS - 1) {
            throw error;
          }
        }
      }
    } catch (err) {
      // Rollback TableOrder yang baru dibuat (cegah meja stuck OCCUPIED tanpa transaksi)
      if (createdNewTableOrder && tableOrderId && bodyTableId) {
        try {
          await prisma.$transaction([
            prisma.tableOrder.delete({ where: { id: tableOrderId } }),
            prisma.table.update({
              where: { id: bodyTableId },
              data: { status: "EMPTY" },
            }),
          ]);
        } catch (rollbackErr) {
          console.error("Failed to rollback TableOrder:", rollbackErr);
        }
      }
      throw err;
    }

    if (!transaction) {
      // Rollback juga kalau transaction null (tidak seharusnya terjadi)
      if (createdNewTableOrder && tableOrderId && bodyTableId) {
        await prisma.$transaction([
          prisma.tableOrder.delete({ where: { id: tableOrderId } }),
          prisma.table.update({
            where: { id: bodyTableId },
            data: { status: "EMPTY" },
          }),
        ]).catch((e) => console.error("Rollback failed:", e));
      }
      throw new Error("Gagal membuat nomor invoice transaksi.");
    }

    let tableOrderError: string | null = null;

    if (tableOrderId) {
      // Ada meja — alur dine-in
      try {
        await prisma.$transaction(async (tx) => {
          const tableOrder = await tx.tableOrder.findFirst({
            where: {
              id: tableOrderId,
              tenantId,
              closedAt: null,
              table: { outletId: activeOutletId },
            },
            select: { id: true, tableId: true },
          });
          if (!tableOrder) {
            throw new Error(`TableOrder ${tableOrderId} tidak ditemukan atau bukan milik tenant.`);
          }

          // PAY_FIRST + belum ada OrderItem → auto-create dari TransactionItem
          // (kasir bayar dulu sebelum kirim ke dapur)
          if (isPayFirst && !tableOrderHasItems) {
            for (const item of transactionItems) {
              await tx.orderItem.create({
                data: {
                  tableOrderId: tableOrder.id,
                  tenantId,
                  productId: item.productId,
                  productName: item.productName,
                  productSku: item.productSku ?? null,
                  variantSkuId: item.variantSkuId ?? null,
                  variantLabel: item.variantLabel ?? null,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  status: "PENDING",
                  modifiers: item.modifiers && item.modifiers.length > 0
                    ? {
                        create: item.modifiers.map((m) => ({
                          modifierGroupName: m.groupName,
                          modifierOptionName: m.optionName,
                          extraPrice: m.extraPrice,
                        })),
                      }
                    : undefined,
                },
              });
            }
          }

          // Link transaksi ke TableOrder (tapi jangan tutup dulu untuk PAY_FIRST)
          await tx.tableOrder.update({
            where: { id: tableOrder.id },
            data: {
              transactionId: transaction!.id,
              // PAY_LATER → tutup order setelah bayar (alur sekarang)
              // PAY_FIRST → biarkan terbuka, tutup saat semua item SERVED (lihat order-items API)
              ...(isPayFirst ? {} : { closedAt: new Date() }),
            },
          });

          // Update status meja
          // PAY_LATER → langsung EMPTY (selesai)
          // PAY_FIRST → tetap OCCUPIED sampai semua item disajikan
          if (!isPayFirst) {
            await tx.table.update({
              where: { id: tableOrder.tableId },
              data: { status: "EMPTY" },
            });
          }
        });
      } catch (err) {
        // Transaksi sudah committed — tableOrder gagal di-settle.
        // Log error dan tambahkan warning di response agar kasir tahu.
        const msg = err instanceof Error ? err.message : "Gagal update meja.";
        console.error("Failed to handle table order after payment:", err);
        tableOrderError = `Pembayaran berhasil tapi gagal update meja: ${msg}. Hubungi owner.`;
      }
    } else if (isPayFirst) {
      // Takeaway PAY_FIRST: create OrderItem langsung ke Transaction agar muncul di Kitchen Display
      try {
        await prisma.$transaction(
          transactionItems.map((item) =>
            prisma.orderItem.create({
              data: {
                transactionId: transaction!.id,
                tenantId,
                productId: item.productId,
                productName: item.productName,
                productSku: item.productSku ?? null,
                variantSkuId: item.variantSkuId ?? null,
                variantLabel: item.variantLabel ?? null,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                status: "PENDING",
                modifiers: item.modifiers && item.modifiers.length > 0
                  ? {
                      create: item.modifiers.map((m) => ({
                        modifierGroupName: m.groupName,
                        modifierOptionName: m.optionName,
                        extraPrice: m.extraPrice,
                      })),
                    }
                  : undefined,
              },
            })
          )
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Gagal kirim ke dapur.";
        console.error("Failed to create order items for takeaway:", err);
        tableOrderError = `Pembayaran berhasil tapi gagal kirim ke dapur: ${msg}. Hubungi owner.`;
      }
    }

    // Notifikasi in-app: transaksi baru (hanya untuk OWNER, bukan kasir sendiri)
    // Hanya buat notifikasi jika yang transaksi adalah kasir (bukan owner)
    if (session.user.role === "KASIR") {
      const outlet = await prisma.outlet.findUnique({
        where: { id: activeOutletId },
        select: { name: true },
      });
      const cashierName = session.user.name ?? "Kasir";
      createNotification({
        tenantId,
        type: "NEW_TRANSACTION",
        title: "Transaksi Baru",
        message: `${cashierName} menyelesaikan transaksi ${transaction.invoiceNumber} senilai Rp ${transaction.total.toLocaleString("id-ID")} di ${outlet?.name ?? "cabang"}.`,
        link: "/dashboard/transactions",
      });
    }

    // Notifikasi stok menipis/habis setelah transaksi
    // Cek stok produk yang baru saja dijual (hanya produk non-varian)
    const soldProductIds = transactionItems
      .filter((i) => !i.variantSkuId)
      .map((i) => i.productId);

    if (soldProductIds.length > 0) {
      // Ambil stok produk yang dijual, filter di JS karena Prisma tidak support
      // column-to-column comparison (stock <= minStock) di where clause
      const stockItems = await prisma.outletStock.findMany({
        where: {
          outletId: activeOutletId,
          productId: { in: soldProductIds },
        },
        select: {
          stock: true,
          minStock: true,
          product: { select: { name: true } },
          outlet: { select: { name: true } },
        },
      });

      const lowItems = stockItems
        .filter((s) => s.stock <= s.minStock)
        .map((s) => ({
          productName: s.product.name,
          stock: s.stock,
          minStock: s.minStock,
          outletName: s.outlet.name,
        }));

      if (lowItems.length > 0) {
        notifyLowStock(tenantId, lowItems);
      }
    }

    return NextResponse.json(
      {
        success: true,
        transaction,
        earnedPoints,
        ...(tableOrderError ? { warning: tableOrderError } : {}),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Transaction error:", error);
    if (error instanceof Error && error.message === "INSUFFICIENT_POINTS") {
      return NextResponse.json(
        { error: "Saldo poin pelanggan berubah. Periksa ulang poin yang ditukar." },
        { status: 400 }
      );
    }
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
