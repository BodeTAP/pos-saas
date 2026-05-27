/**
 * Helper untuk cetak struk dapur via browser print.
 * Bisa dipanggil dari mana saja — POS, table detail, kitchen display.
 */

import type { KitchenReceiptData } from "@/components/pos/receipt";

/**
 * Render struk dapur sebagai HTML string siap-print.
 */
export function renderKitchenReceiptHTML(data: KitchenReceiptData): string {
  const formatTime = (d: Date) =>
    d.toLocaleString("id-ID", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

  const itemsHTML = data.items
    .map(
      (item) => `
      <div style="margin-bottom:8px">
        <div style="display:flex;gap:8px">
          <strong style="width:24px;text-align:right">${item.quantity}x</strong>
          <strong>${escapeHtml(item.name)}</strong>
        </div>
        ${
          item.modifiers && item.modifiers.length > 0
            ? item.modifiers
                .map((m) => `<div style="padding-left:32px;font-size:12px">→ ${escapeHtml(m.optionName)}</div>`)
                .join("")
            : ""
        }
        ${item.note ? `<div style="padding-left:32px;font-size:12px;font-style:italic">! ${escapeHtml(item.note)}</div>` : ""}
      </div>
    `
    )
    .join("");

  return `
    <div style="font-family:monospace;width:80mm;padding:4mm;font-size:12px;line-height:1.5">
      <div style="text-align:center;margin-bottom:8px">
        <strong style="font-size:14px">*** STRUK DAPUR ***</strong><br>
        <strong style="font-size:18px">${
          data.tableNumber
            ? `MEJA #${escapeHtml(data.tableNumber)}${data.tableArea ? ` — ${escapeHtml(data.tableArea)}` : ""}`
            : "TAKEAWAY"
        }</strong>
      </div>
      <div style="text-align:center">================================</div>
      <div style="font-size:11px;margin:4px 0">
        <div style="display:flex;justify-content:space-between"><span>No.</span><span>${escapeHtml(data.invoiceNumber)}</span></div>
        <div style="display:flex;justify-content:space-between"><span>Waktu</span><span>${formatTime(data.createdAt)}</span></div>
        ${data.cashierName ? `<div style="display:flex;justify-content:space-between"><span>Kasir</span><span>${escapeHtml(data.cashierName)}</span></div>` : ""}
      </div>
      <div style="text-align:center">================================</div>
      <div style="margin:8px 0">${itemsHTML}</div>
      <div style="text-align:center">--------------------------------</div>
      ${data.note ? `<div style="font-style:italic;text-align:center;font-size:11px">Catatan: ${escapeHtml(data.note)}</div>` : ""}
      <div style="text-align:center;font-size:11px;margin-top:4px">*** SEGERA DIPROSES ***</div>
    </div>
  `;
}

/**
 * Buka jendela baru, render struk, lalu trigger print otomatis.
 * Aman dipanggil dari event handler (user gesture).
 */
export function printKitchenReceipt(data: KitchenReceiptData): boolean {
  const html = renderKitchenReceiptHTML(data);
  const win = window.open("", "_blank", "width=400,height=600");
  if (!win) {
    console.warn("[printKitchenReceipt] Pop-up blocked.");
    return false;
  }
  win.document.write(`
    <html>
      <head>
        <title>Struk Dapur</title>
        <style>
          body { font-family: monospace; margin: 0; padding: 8px; }
          @media print { body { margin: 0; } }
        </style>
      </head>
      <body>${html}</body>
    </html>
  `);
  win.document.close();
  win.focus();
  setTimeout(() => {
    try {
      win.print();
      win.close();
    } catch (err) {
      console.error("[printKitchenReceipt] Print failed:", err);
    }
  }, 300);
  return true;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
