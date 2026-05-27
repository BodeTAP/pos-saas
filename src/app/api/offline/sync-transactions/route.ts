import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getActiveOutletId } from "@/lib/active-outlet";
import { generateInvoiceNumber } from "@/lib/utils";
import { Prisma } from "@prisma/client";

const POINT_VALUE = 100;
const POINT_PER_AMOUNT = 10000;
const MAX_INVOICE_ATTEMPTS = 3;

function isInvoiceConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;
  const target = error.meta?.target;
  return Array.isArray(target)
    ? target.includes("invoiceNumber")
    : String(target).includes("invoiceNumber");
}

/**
 * POST /api/offline/sync-transactions
 * Terima array transaksi offline dari queue IndexedDB.
 * Proses satu per satu, return hasil per transaksi.
 *
 * Idempotency: jika offlineLocalId sudah pernah diproses, skip (return SYNCED).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json() as {
      transactions: Array<{
        localId: string;
        invoiceNumber: string; // nomor invoice lokal (untuk referensi)
        payload: {
          items: Array<{
            productId: string;
            productName: string;
            productSku?: string | null;
            quantity: number;
            unitPrice: number;
            discount: number;
            subtotal: number;
            variantSkuId?: string | null;
            variantLabel?: string | null;
            modifiers?: Array<{
              groupName: string;
              optionName: string;
              extraPrice: number;
            }>;
          }>;
          subtotal: number;
          discount: number;
          discountPct: number;
          discountNominal: number;
          tax: number;
          taxPct: number;
          serviceChargePct?: number;
          serviceCharge?: number;
          total: number;
          amountPaid: number;
          change: number;
          paymentMethod: string;
          note: string | null;
          cashierId: string;
          tenantId: string;
          customerId: string | null;
          pointsRedeemed: number;
          tableOrderId?: string | null;
        };
      }>;
    };

    if (!body.transactions || !Array.isArray(body.transactions)) {
      return NextResponse.json({ error: "Format tidak valid." }, { status: 400 });
    }

    const outletId = await getActiveOutletId();
    if (!outletId) {
      return NextResponse.json({ error: "Cabang aktif tidak ditemukan." }, { status: 400 });
    }

    const tenantConfig = await prisma.tenant.findUnique({
      where: { id: session.user.tenantId },
      select: {
        pointsPerAmount: true,
        pointValue: true,
        taxRate: true,
        activePaymentMethods: true,
        invoicePrefix: true,
        businessType: true,
        paymentFlow: true,
      },
    });

    if (!tenantConfig) {
      return NextResponse.json({ error: "Tenant tidak ditemukan." }, { status: 404 });
    }

    const results: Array<{
      localId: string;
      status: "SYNCED" | "FAILED" | "SKIPPED";
      serverInvoiceNumber?: string;
      error?: string;
    }> = [];

    for (const tx of body.transactions) {
      try {
        // Idempotency: cek apakah localId sudah pernah diproses
        // Kita simpan localId di field `note` dengan prefix [OFFLINE:localId]
        const existing = await prisma.transaction.findFirst({
          where: {
            tenantId: session.user.tenantId,
            note: { contains: `[OFFLINE:${tx.localId}]` },
          },
          select: { invoiceNumber: true },
        });

        if (existing) {
          results.push({
            localId: tx.localId,
            status: "SKIPPED",
            serverInvoiceNumber: existing.invoiceNumber,
          });
          continue;
        }

        const { payload } = tx;

        // Validasi tenantId
        if (payload.tenantId !== session.user.tenantId && session.user.role !== "SUPER_ADMIN") {
          results.push({ localId: tx.localId, status: "FAILED", error: "Tenant tidak valid." });
          continue;
        }

        // Validasi produk
        const productIds = [...new Set(payload.items.map((i) => i.productId))];
        const ownedProducts = await prisma.product.findMany({
          where: { id: { in: productIds }, tenantId: session.user.tenantId, isActive: true },
          select: { id: true, name: true, sku: true, sellPrice: true, buyPrice: true },
        });

        if (ownedProducts.length !== productIds.length) {
          results.push({ localId: tx.localId, status: "FAILED", error: "Satu atau lebih produk tidak valid." });
          continue;
        }

        // Bug 5 fix: Validasi variantSkuId milik produk tenant
        const variantSkuIds = payload.items
          .map((i) => i.variantSkuId)
          .filter(Boolean) as string[];

        const variantSkusById = new Map<string, { id: string; price: number; buyPrice: number; sku: string | null; productId: string }>();
        if (variantSkuIds.length > 0) {
          const variantSkus = await prisma.productVariantSKU.findMany({
            where: { id: { in: variantSkuIds }, productId: { in: productIds }, isActive: true },
            select: { id: true, price: true, buyPrice: true, sku: true, productId: true },
          });
          if (variantSkus.length !== variantSkuIds.length) {
            results.push({ localId: tx.localId, status: "FAILED", error: "Satu atau lebih varian tidak valid." });
            continue;
          }
          variantSkus.forEach((vs) => variantSkusById.set(vs.id, vs));
        }

        const productsById = new Map(ownedProducts.map((p) => [p.id, p]));
        const pointsPerAmount = tenantConfig.pointsPerAmount || POINT_PER_AMOUNT;
        const pointValue = tenantConfig.pointValue || POINT_VALUE;
        const earnedPoints = Math.floor(payload.total / pointsPerAmount);
        const redeemedPoints = payload.pointsRedeemed || 0;

        // Buat transaksi dengan retry untuk invoice conflict
        let serverInvoiceNumber: string | null = null;
        for (let attempt = 0; attempt < MAX_INVOICE_ATTEMPTS; attempt++) {
          const invoiceNumber = generateInvoiceNumber(tenantConfig.invoicePrefix || "INV");
          try {
            await prisma.$transaction(async (txPrisma) => {
              // Buat transaksi
              const newTx = await txPrisma.transaction.create({
                data: {
                  invoiceNumber,
                  status: "COMPLETED",
                  paymentMethod: payload.paymentMethod as "CASH" | "QRIS" | "TRANSFER" | "CARD" | "OTHER",
                  subtotal: payload.subtotal,
                  discount: payload.discount,
                  discountPct: payload.discountPct,
                  tax: payload.tax,
                  taxPct: payload.taxPct,
                  total: payload.total,
                  amountPaid: payload.amountPaid,
                  change: payload.change,
                  pointsEarned: earnedPoints,
                  pointsRedeemed: redeemedPoints,
                  // Simpan localId di note untuk idempotency
                  note: payload.note
                    ? `${payload.note} [OFFLINE:${tx.localId}]`
                    : `[OFFLINE:${tx.localId}]`,
                  tenantId: session.user.tenantId!,
                  cashierId: payload.cashierId,
                  customerId: payload.customerId || null,
                  outletId,
                  items: {
                    create: payload.items.map((item) => {
                      const product = productsById.get(item.productId)!;
                      // Bug 4 fix: pakai harga varian dari DB, bukan harga produk dasar
                      const variantSku = item.variantSkuId ? variantSkusById.get(item.variantSkuId) : null;
                      const baseUnitPrice = variantSku ? variantSku.price : product.sellPrice;
                      // F&B: harga unit final = base + total extra modifier
                      const modifierExtra = (item.modifiers ?? []).reduce((s, m) => s + (m.extraPrice ?? 0), 0);
                      const unitPrice = baseUnitPrice + modifierExtra;
                      const buyPrice = variantSku ? variantSku.buyPrice : product.buyPrice;
                      const itemSku = variantSku?.sku ?? product.sku;
                      return {
                        productId: item.productId,
                        productName: product.name,
                        productSku: itemSku || null,
                        quantity: item.quantity,
                        unitPrice,
                        buyPrice,
                        discount: item.discount || 0,
                        subtotal: unitPrice * item.quantity - (item.discount || 0),
                        variantSkuId: item.variantSkuId || null,
                        variantLabel: item.variantLabel || null,
                        // F&B: snapshot modifiers
                        modifiers: item.modifiers && item.modifiers.length > 0
                          ? {
                              create: item.modifiers.map((m) => ({
                                modifierGroupId: "",
                                modifierGroupName: m.groupName,
                                modifierOptionId: "",
                                modifierOptionName: m.optionName,
                                extraPrice: m.extraPrice,
                              })),
                            }
                          : undefined,
                      };
                    }),
                  },
                },
              });

              // Atomic stock deduction
              for (const item of payload.items) {
                if (item.variantSkuId) {
                  // Deduct dari OutletStockVariant
                  const updated = await txPrisma.outletStockVariant.updateMany({
                    where: {
                      outletId,
                      skuId: item.variantSkuId,
                      stock: { gte: item.quantity },
                    },
                    data: { stock: { decrement: item.quantity } },
                  });

                  if (updated.count === 0) {
                    throw new Error(`Stok ${item.productName} (${item.variantLabel ?? item.variantSkuId}) tidak cukup.`);
                  }

                  const updatedStock = await txPrisma.outletStockVariant.findUnique({
                    where: { outletId_skuId: { outletId, skuId: item.variantSkuId } },
                    select: { stock: true },
                  });
                  const stockBefore = (updatedStock?.stock ?? 0) + item.quantity;

                  await txPrisma.stockMutationVariant.create({
                    data: {
                      type: "SALE",
                      quantity: -item.quantity,
                      stockBefore,
                      stockAfter: updatedStock?.stock ?? 0,
                      note: `Penjualan offline - ${invoiceNumber}`,
                      tenantId: session.user.tenantId!,
                      skuId: item.variantSkuId,
                      outletId,
                    },
                  });
                } else {
                  const updated = await txPrisma.outletStock.updateMany({
                    where: {
                      outletId,
                      productId: item.productId,
                      stock: { gte: item.quantity },
                    },
                    data: { stock: { decrement: item.quantity } },
                  });

                  if (updated.count === 0) {
                    throw new Error(`Stok ${item.productName} tidak cukup.`);
                  }

                  const updatedStock = await txPrisma.outletStock.findUnique({
                    where: { outletId_productId: { outletId, productId: item.productId } },
                    select: { stock: true },
                  });
                  const stockBefore = (updatedStock?.stock ?? 0) + item.quantity;

                  await txPrisma.stockMutation.create({
                    data: {
                      type: "SALE",
                      quantity: -item.quantity,
                      stockBefore,
                      stockAfter: updatedStock?.stock ?? 0,
                      note: `Penjualan offline - ${invoiceNumber}`,
                      tenantId: session.user.tenantId!,
                      productId: item.productId,
                      outletId,
                    },
                  });
                }
              }

              // Update poin pelanggan
              if (payload.customerId) {
                const pointsDelta = earnedPoints - redeemedPoints;
                if (pointsDelta !== 0 || redeemedPoints > 0) {
                  await txPrisma.customer.updateMany({
                    where: {
                      id: payload.customerId,
                      tenantId: session.user.tenantId!,
                      ...(redeemedPoints > 0 && { points: { gte: redeemedPoints } }),
                    },
                    data: { points: { increment: pointsDelta } },
                  });
                }
              }

              serverInvoiceNumber = newTx.invoiceNumber;
            });
            break; // Sukses, keluar dari retry loop
          } catch (err) {
            if (!isInvoiceConflict(err) || attempt === MAX_INVOICE_ATTEMPTS - 1) {
              throw err;
            }
          }
        }

        // F&B: Handle table order + auto-create OrderItem (replikasi alur online)
        const isFnB = tenantConfig.businessType === "FNB";
        const isPayFirst = isFnB && tenantConfig.paymentFlow === "PAY_FIRST";

        if (serverInvoiceNumber) {
          try {
            const createdTx = await prisma.transaction.findFirst({
              where: {
                tenantId: session.user.tenantId!,
                invoiceNumber: serverInvoiceNumber,
              },
              select: { id: true },
            });

            if (createdTx) {
              if (payload.tableOrderId) {
                // Dine-in
                const tableOrder = await prisma.tableOrder.findFirst({
                  where: {
                    id: payload.tableOrderId,
                    tenantId: session.user.tenantId!,
                    closedAt: null,
                    table: { outletId: outletId },
                  },
                  select: { id: true, tableId: true },
                });

                if (tableOrder) {
                  // Cek apakah sudah ada OrderItem (kasir kirim ke dapur sebelumnya)
                  const existingCount = await prisma.orderItem.count({
                    where: {
                      tableOrderId: tableOrder.id,
                      tenantId: session.user.tenantId!,
                      status: { not: "CANCELLED" },
                    },
                  });

                  // PAY_FIRST + belum ada OrderItem → auto-create
                  if (isPayFirst && existingCount === 0) {
                    for (const item of payload.items) {
                      const product = productsById.get(item.productId);
                      const variantSku = item.variantSkuId ? variantSkusById.get(item.variantSkuId) : null;
                      const baseUnitPrice = variantSku ? variantSku.price : (product?.sellPrice ?? item.unitPrice);
                      const modifierExtra = (item.modifiers ?? []).reduce((s, m) => s + (m.extraPrice ?? 0), 0);
                      const unitPrice = baseUnitPrice + modifierExtra;

                      await prisma.orderItem.create({
                        data: {
                          tableOrderId: tableOrder.id,
                          tenantId: session.user.tenantId!,
                          productId: item.productId,
                          productName: product?.name ?? item.productName,
                          productSku: variantSku?.sku ?? product?.sku ?? null,
                          variantSkuId: item.variantSkuId ?? null,
                          variantLabel: item.variantLabel ?? null,
                          quantity: item.quantity,
                          unitPrice,
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

                  // Link transaksi ke TableOrder
                  // PAY_LATER → close + meja EMPTY
                  // PAY_FIRST → biarkan terbuka, tutup saat semua item SERVED
                  await prisma.tableOrder.update({
                    where: { id: tableOrder.id },
                    data: {
                      transactionId: createdTx.id,
                      ...(isPayFirst ? {} : { closedAt: new Date() }),
                    },
                  });

                  if (!isPayFirst) {
                    await prisma.table.update({
                      where: { id: tableOrder.tableId },
                      data: { status: "EMPTY" },
                    });
                  }
                }
              } else if (isPayFirst) {
                // Takeaway PAY_FIRST: create OrderItem ke transaction
                for (const item of payload.items) {
                  const product = productsById.get(item.productId);
                  const variantSku = item.variantSkuId ? variantSkusById.get(item.variantSkuId) : null;
                  const baseUnitPrice = variantSku ? variantSku.price : (product?.sellPrice ?? item.unitPrice);
                  const modifierExtra = (item.modifiers ?? []).reduce((s, m) => s + (m.extraPrice ?? 0), 0);
                  const unitPrice = baseUnitPrice + modifierExtra;

                  await prisma.orderItem.create({
                    data: {
                      transactionId: createdTx.id,
                      tenantId: session.user.tenantId!,
                      productId: item.productId,
                      productName: product?.name ?? item.productName,
                      productSku: variantSku?.sku ?? product?.sku ?? null,
                      variantSkuId: item.variantSkuId ?? null,
                      variantLabel: item.variantLabel ?? null,
                      quantity: item.quantity,
                      unitPrice,
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
            }
          } catch (tableErr) {
            console.error("Failed to handle F&B order during offline sync:", tableErr);
          }
        }

        results.push({
          localId: tx.localId,
          status: "SYNCED",
          serverInvoiceNumber: serverInvoiceNumber!,
        });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Gagal memproses transaksi.";
        results.push({ localId: tx.localId, status: "FAILED", error: errorMsg });
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Sync transactions error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
