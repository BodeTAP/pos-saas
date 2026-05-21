import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * Transfer stok produk dari satu outlet ke outlet lain.
 * Mencatat 2 StockMutation: OUT dari sumber, IN ke tujuan.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user.tenantId || session.user.role !== "OWNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { fromOutletId, toOutletId, productId, quantity, note } = body;

    if (!fromOutletId || !toOutletId || !productId || !quantity) {
      return NextResponse.json(
        { error: "fromOutletId, toOutletId, productId, dan quantity wajib diisi." },
        { status: 400 }
      );
    }

    if (fromOutletId === toOutletId) {
      return NextResponse.json(
        { error: "Cabang asal dan tujuan tidak boleh sama." },
        { status: 400 }
      );
    }

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) {
      return NextResponse.json(
        { error: "Jumlah transfer harus lebih dari 0." },
        { status: 400 }
      );
    }

    const tenantId = session.user.tenantId;

    // Validasi outlet milik tenant ini
    const [fromOutlet, toOutlet] = await Promise.all([
      prisma.outlet.findFirst({ where: { id: fromOutletId, tenantId, isActive: true } }),
      prisma.outlet.findFirst({ where: { id: toOutletId, tenantId, isActive: true } }),
    ]);

    if (!fromOutlet) {
      return NextResponse.json({ error: "Cabang asal tidak valid." }, { status: 400 });
    }
    if (!toOutlet) {
      return NextResponse.json({ error: "Cabang tujuan tidak valid." }, { status: 400 });
    }

    // Validasi produk milik tenant
    const product = await prisma.product.findFirst({
      where: { id: productId, tenantId },
      select: { id: true, name: true },
    });
    if (!product) {
      return NextResponse.json({ error: "Produk tidak ditemukan." }, { status: 404 });
    }

    // Cek stok di outlet asal
    const fromStock = await prisma.outletStock.findUnique({
      where: { outletId_productId: { outletId: fromOutletId, productId } },
    });

    if (!fromStock || fromStock.stock < qty) {
      return NextResponse.json(
        {
          error: `Stok di ${fromOutlet.name} tidak cukup (tersedia: ${fromStock?.stock || 0}).`,
        },
        { status: 400 }
      );
    }

    // Jalankan transfer dalam satu transaksi DB
    await prisma.$transaction(async (tx) => {
      // Kurangi stok di outlet asal
      await tx.outletStock.update({
        where: { id: fromStock.id },
        data: { stock: fromStock.stock - qty },
      });

      // Tambah stok di outlet tujuan (upsert)
      const toStock = await tx.outletStock.findUnique({
        where: { outletId_productId: { outletId: toOutletId, productId } },
      });

      if (toStock) {
        await tx.outletStock.update({
          where: { id: toStock.id },
          data: { stock: toStock.stock + qty },
        });
      } else {
        await tx.outletStock.create({
          data: {
            outletId: toOutletId,
            productId,
            tenantId,
            stock: qty,
            minStock: fromStock.minStock,
          },
        });
      }

      const transferNote = note || `Transfer ke ${toOutlet.name}`;
      const receiveNote = note || `Transfer dari ${fromOutlet.name}`;

      // Catat mutasi OUT di outlet asal
      await tx.stockMutation.create({
        data: {
          type: "OUT",
          quantity: -qty,
          stockBefore: fromStock.stock,
          stockAfter: fromStock.stock - qty,
          note: transferNote,
          tenantId,
          productId,
          outletId: fromOutletId,
        },
      });

      // Catat mutasi IN di outlet tujuan
      const toStockBefore = toStock?.stock || 0;
      await tx.stockMutation.create({
        data: {
          type: "IN",
          quantity: qty,
          stockBefore: toStockBefore,
          stockAfter: toStockBefore + qty,
          note: receiveNote,
          tenantId,
          productId,
          outletId: toOutletId,
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: `${qty} unit ${product.name} berhasil ditransfer dari ${fromOutlet.name} ke ${toOutlet.name}.`,
    });
  } catch (error) {
    console.error("Transfer stock error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
