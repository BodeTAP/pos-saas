import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import * as XLSX from "xlsx";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user.tenantId || session.user.role !== "OWNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const format = (searchParams.get("format") || "excel").toLowerCase();
    const startParam = searchParams.get("start");
    const endParam = searchParams.get("end");

    const since = startParam ? new Date(startParam) : new Date();
    if (!startParam) {
      since.setDate(since.getDate() - 30);
    }
    since.setHours(0, 0, 0, 0);

    const until = endParam ? new Date(endParam) : new Date();
    until.setHours(23, 59, 59, 999);

    const transactions = await prisma.transaction.findMany({
      where: {
        tenantId: session.user.tenantId,
        status: "COMPLETED",
        createdAt: { gte: since, lte: until },
        ...(session.user.outletId && { outletId: session.user.outletId }),
      },
      include: {
        cashier: { select: { name: true } },
        customer: { select: { name: true } },
        outlet: { select: { name: true } },
        items: true,
      },
      orderBy: { createdAt: "desc" },
      take: 10000,
    });

    const isTruncated = transactions.length === 10000;

    const paymentLabel: Record<string, string> = {
      CASH: "Tunai",
      QRIS: "QRIS",
      TRANSFER: "Transfer",
      CARD: "Kartu",
      OTHER: "Lainnya",
    };

    // Sheet 1: Ringkasan Transaksi
    const transactionsRows = transactions.map((tx) => ({
      "No. Invoice": tx.invoiceNumber,
      Tanggal: tx.createdAt.toLocaleString("id-ID", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      Kasir: tx.cashier.name,
      Cabang: tx.outlet?.name || "-",
      Pelanggan: tx.customer?.name || "-",
      "Jumlah Item": tx.items.reduce((s, i) => s + i.quantity, 0),
      Subtotal: tx.subtotal,
      Diskon: tx.discount,
      "PPN (%)": tx.taxPct,
      Pajak: tx.tax,
      Total: tx.total,
      Dibayar: tx.amountPaid,
      Kembalian: tx.change,
      "Metode Bayar": paymentLabel[tx.paymentMethod] || tx.paymentMethod,
      Catatan: tx.note || "",
    }));

    // Sheet 2: Detail Item Transaksi (dengan kolom laba)
    const itemsRows: Record<string, string | number>[] = [];
    for (const tx of transactions) {
      for (const item of tx.items) {
        const hpp = item.buyPrice * item.quantity;
        const labaKotor = item.subtotal - hpp;
        const margin = item.subtotal > 0 ? (labaKotor / item.subtotal) * 100 : 0;
        itemsRows.push({
          "No. Invoice": tx.invoiceNumber,
          Tanggal: tx.createdAt.toLocaleDateString("id-ID"),
          Produk: item.productName,
          Varian: item.variantLabel || "",
          SKU: item.productSku || "",
          Qty: item.quantity,
          "Harga Jual": item.unitPrice,
          "Harga Beli": item.buyPrice,
          Diskon: item.discount,
          Subtotal: item.subtotal,
          HPP: hpp,
          "Laba Kotor": labaKotor,
          "Margin (%)": parseFloat(margin.toFixed(2)),
        });
      }
    }

    // Sheet 3: Laba Kotor per Produk
    const profitByProduct = new Map<string, {
      name: string;
      quantity: number;
      revenue: number;
      cogs: number;
    }>();
    for (const tx of transactions) {
      for (const item of tx.items) {
        const key = item.productId;
        const existing = profitByProduct.get(key);
        if (existing) {
          existing.quantity += item.quantity;
          existing.revenue += item.subtotal;
          existing.cogs += item.buyPrice * item.quantity;
        } else {
          profitByProduct.set(key, {
            name: item.productName,
            quantity: item.quantity,
            revenue: item.subtotal,
            cogs: item.buyPrice * item.quantity,
          });
        }
      }
    }
    const profitRows = Array.from(profitByProduct.values())
      .sort((a, b) => b.revenue - a.revenue)
      .map((p) => {
        const labaKotor = p.revenue - p.cogs;
        const margin = p.revenue > 0 ? (labaKotor / p.revenue) * 100 : 0;
        return {
          Produk: p.name,
          "Qty Terjual": p.quantity,
          Pendapatan: p.revenue,
          HPP: p.cogs,
          "Laba Kotor": labaKotor,
          "Margin (%)": parseFloat(margin.toFixed(2)),
        };
      });

    // Hitung ringkasan
    const totalRevenue = transactions.reduce((s, t) => s + t.total, 0);
    const totalSubtotal = transactions.reduce((s, t) => s + t.subtotal, 0);
    const totalDiscount = transactions.reduce((s, t) => s + t.discount, 0);
    const totalTax = transactions.reduce((s, t) => s + t.tax, 0);
    const totalCogs = transactions.reduce(
      (s, t) => s + t.items.reduce((si, i) => si + i.buyPrice * i.quantity, 0),
      0
    );
    // Laba kotor dihitung dari subtotal (sebelum pajak) agar konsisten dengan HPP item
    const totalGrossProfit = totalSubtotal - totalCogs;
    const totalMargin = totalSubtotal > 0 ? (totalGrossProfit / totalSubtotal) * 100 : 0;

    const summaryRows = [
      {
        Metrik: "Periode",
        Nilai: `${since.toLocaleDateString("id-ID")} — ${until.toLocaleDateString("id-ID")}`,
      },
      { Metrik: "Total Transaksi", Nilai: transactions.length },
      { Metrik: "Total Pendapatan", Nilai: totalRevenue },
      { Metrik: "Total Diskon", Nilai: totalDiscount },
      { Metrik: "Total PPN", Nilai: totalTax },
      { Metrik: "Total HPP", Nilai: totalCogs },
      { Metrik: "Laba Kotor", Nilai: totalGrossProfit },
      { Metrik: "Margin Kotor (%)", Nilai: parseFloat(totalMargin.toFixed(2)) },
      {
        Metrik: "Rata-rata per Transaksi",
        Nilai: transactions.length > 0 ? totalRevenue / transactions.length : 0,
      },
      ...(isTruncated
        ? [{ Metrik: "PERINGATAN", Nilai: "Data dibatasi 10.000 transaksi. Perkecil rentang tanggal untuk data lengkap." }]
        : []),
    ];

    const fileName = `laporan-${new Date().toISOString().slice(0, 10)}`;

    if (format === "csv") {
      const ws = XLSX.utils.json_to_sheet(transactionsRows);
      const csv = XLSX.utils.sheet_to_csv(ws);

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${fileName}.csv"`,
          ...(isTruncated && { "X-Data-Truncated": "true" }),
        },
      });
    }

    // Excel: multi-sheet
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), "Ringkasan");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(transactionsRows), "Transaksi");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(itemsRows), "Detail Item");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(profitRows), "Laba Kotor");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Export report error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
