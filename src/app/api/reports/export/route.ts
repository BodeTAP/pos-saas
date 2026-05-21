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
      take: 10000, // Safety limit to prevent memory exhaustion
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

    // Sheet 2: Detail Item Transaksi
    const itemsRows: Record<string, string | number>[] = [];
    for (const tx of transactions) {
      for (const item of tx.items) {
        itemsRows.push({
          "No. Invoice": tx.invoiceNumber,
          Tanggal: tx.createdAt.toLocaleDateString("id-ID"),
          Produk: item.productName,
          SKU: item.productSku || "",
          Qty: item.quantity,
          "Harga Satuan": item.unitPrice,
          Diskon: item.discount,
          Subtotal: item.subtotal,
        });
      }
    }

    // Hitung ringkasan
    const totalRevenue = transactions.reduce((s, t) => s + t.total, 0);
    const totalDiscount = transactions.reduce((s, t) => s + t.discount, 0);
    const totalTax = transactions.reduce((s, t) => s + t.tax, 0);
    const summaryRows = [
      {
        Metrik: "Periode",
        Nilai: `${since.toLocaleDateString("id-ID")} — ${until.toLocaleDateString("id-ID")}`,
      },
      { Metrik: "Total Transaksi", Nilai: transactions.length },
      { Metrik: "Total Pendapatan", Nilai: totalRevenue },
      { Metrik: "Total Diskon", Nilai: totalDiscount },
      { Metrik: "Total PPN", Nilai: totalTax },
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
      // CSV: gabung semua transaksi jadi satu file
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
    const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
    const wsTransactions = XLSX.utils.json_to_sheet(transactionsRows);
    const wsItems = XLSX.utils.json_to_sheet(itemsRows);

    XLSX.utils.book_append_sheet(wb, wsSummary, "Ringkasan");
    XLSX.utils.book_append_sheet(wb, wsTransactions, "Transaksi");
    XLSX.utils.book_append_sheet(wb, wsItems, "Detail Item");

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
