import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { ReceiptData } from "@/components/pos/receipt";

const paymentLabel: Record<string, string> = {
  CASH: "Tunai",
  QRIS: "QRIS",
  TRANSFER: "Transfer Bank",
  CARD: "Kartu",
  OTHER: "Lainnya",
};

/**
 * Generate HTML struk lengkap dengan CSS @page yang benar
 * untuk thermal printer 58mm atau 80mm
 */
function generateReceiptHTML(data: ReceiptData): string {
  const widthMm = data.receiptWidth === 58 ? 58 : 80;
  const fontSizePx = widthMm === 58 ? 10 : 11;
  const lineChar = widthMm === 58 ? 32 : 46;
  const divider = "-".repeat(lineChar);

  const itemsHTML = data.items
    .map(
      (item) => {
        const modsHTML = item.modifiers && item.modifiers.length > 0
          ? item.modifiers
              .map(
                (m) => `
        <div class="modifier-row">
          <span>+ ${m.optionName}</span>
          ${m.extraPrice > 0 ? `<span>+${formatCurrency(m.extraPrice)}</span>` : ""}
        </div>`
              )
              .join("")
          : "";
        return `
      <div class="item">
        <div class="item-name">${item.name}</div>
        <div class="item-row">
          <span>${item.quantity} x ${formatCurrency(item.unitPrice)}${
            item.discount > 0 ? ` (-${formatCurrency(item.discount)})` : ""
          }</span>
          <span>${formatCurrency(item.subtotal)}</span>
        </div>
        ${modsHTML}
      </div>`;
      }
    )
    .join("");

  const discountRow =
    data.discountAmount > 0
      ? `<div class="row"><span>Diskon</span><span>- ${formatCurrency(data.discountAmount)}</span></div>`
      : "";

  const serviceChargeRow =
    (data.serviceChargeAmount ?? 0) > 0
      ? `<div class="row"><span>Service Charge (${data.serviceChargePct ?? 0}%)</span><span>${formatCurrency(data.serviceChargeAmount!)}</span></div>`
      : "";

  const taxRow =
    data.taxPct > 0
      ? `<div class="row"><span>PPN (${data.taxPct}%)</span><span>${formatCurrency(data.taxAmount)}</span></div>`
      : "";

  const changeRow =
    data.change > 0
      ? `<div class="row bold"><span>Kembali</span><span>${formatCurrency(data.change)}</span></div>`
      : "";

  const noteSection = data.note
    ? `<div class="divider">${divider}</div><div class="center italic">${data.note}</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Struk ${data.invoiceNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    @page {
      size: ${widthMm}mm auto;
      margin: 3mm;
    }

    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: ${fontSizePx}px;
      line-height: 1.45;
      color: #000;
      background: #fff;
      width: ${widthMm}mm;
    }

    .center { text-align: center; }
    .bold { font-weight: bold; }
    .italic { font-style: italic; }
    .divider { margin: 3px 0; letter-spacing: 0; }
    .store-name { font-size: ${fontSizePx + 2}px; font-weight: bold; text-transform: uppercase; }

    .info-table { width: 100%; margin: 3px 0; }
    .info-table td { padding: 0; vertical-align: top; }
    .info-table td:last-child { text-align: right; }

    .item { margin: 2px 0; }
    .item-name { font-weight: bold; word-break: break-word; }
    .item-row { display: flex; justify-content: space-between; padding-left: 4px; gap: 4px; }
    .modifier-row { display: flex; justify-content: space-between; padding-left: 8px; color: #555; font-size: ${fontSizePx - 1}px; gap: 4px; word-break: break-word; }

    .row { display: flex; justify-content: space-between; margin: 1px 0; }
    .row.bold { font-weight: bold; font-size: ${fontSizePx + 1}px; }
    .total-row {
      display: flex;
      justify-content: space-between;
      font-weight: bold;
      font-size: ${fontSizePx + 2}px;
      border-top: 1px dashed #000;
      padding-top: 3px;
      margin-top: 3px;
    }

    .footer { text-align: center; margin-top: 4px; }
    .footer .note { font-size: ${fontSizePx}px; }
    .footer .legal { font-size: ${fontSizePx - 1}px; color: #555; margin-top: 2px; }
  </style>
</head>
<body>
  <div class="center">
    <div class="store-name">${data.storeName}</div>
    ${data.receiptHeader ? `<div class="italic" style="font-size:${fontSizePx - 1}px">${data.receiptHeader}</div>` : ""}
    ${data.storeAddress ? `<div>${data.storeAddress}</div>` : ""}
    ${data.storePhone ? `<div>Telp: ${data.storePhone}</div>` : ""}
  </div>

  <div class="divider">${divider}</div>

  <table class="info-table">
    <tr><td>No.</td><td>${data.invoiceNumber}</td></tr>
    <tr><td>Tanggal</td><td>${formatDateTime(data.createdAt)}</td></tr>
    <tr><td>Kasir</td><td>${data.cashierName}</td></tr>
    ${data.tableNumber ? `<tr><td>Meja</td><td>#${data.tableNumber}${data.tableArea ? ` (${data.tableArea})` : ""}</td></tr>` : ""}
    <tr><td>Pembayaran</td><td>${paymentLabel[data.paymentMethod] || data.paymentMethod}</td></tr>
  </table>

  <div class="divider">${divider}</div>

  <div class="items">${itemsHTML}</div>

  <div class="divider">${divider}</div>

  <div class="row"><span>Subtotal</span><span>${formatCurrency(data.subtotal)}</span></div>
  ${discountRow}
  ${serviceChargeRow}
  ${taxRow}
  <div class="total-row"><span>TOTAL</span><span>${formatCurrency(data.total)}</span></div>
  <div class="row"><span>Bayar</span><span>${formatCurrency(data.amountPaid)}</span></div>
  ${changeRow}

  ${noteSection}

  <div class="divider">${divider}</div>

  <div class="footer">
    <div class="note">${data.receiptNote || "Terima kasih telah berbelanja!"}</div>
    <div class="legal">* Struk ini adalah bukti pembayaran sah *</div>
  </div>
</body>
</html>`;
}

/**
 * Buka popup window dengan ukuran thermal printer yang tepat,
 * lalu trigger print otomatis
 */
export function printReceipt(data: ReceiptData): void {
  const widthMm = data.receiptWidth === 58 ? 58 : 80;
  // Konversi mm ke pixel (96 DPI: 1mm ≈ 3.78px)
  const widthPx = Math.ceil(widthMm * 3.78) + 20;

  const popup = window.open(
    "",
    "receipt-print",
    `width=${widthPx},height=600,scrollbars=yes,resizable=yes`
  );

  if (!popup) {
    console.error("Popup diblokir browser. Izinkan popup untuk localhost dan coba lagi.");
    return;
  }

  const html = generateReceiptHTML(data);
  popup.document.write(html);
  popup.document.close();

  // Tunggu konten selesai load lalu print
  popup.onload = () => {
    popup.focus();
    popup.print();
    // Tutup popup setelah print dialog ditutup
    popup.onafterprint = () => popup.close();
  };
}

/**
 * Download struk sebagai file HTML yang bisa dibuka dan di-print
 */
export function downloadReceiptHTML(data: ReceiptData): void {
  const html = generateReceiptHTML(data);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `struk-${data.invoiceNumber}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
