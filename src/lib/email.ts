/**
 * Email service menggunakan Resend.
 * Semua fungsi pengiriman email terpusat di sini.
 */

import { Resend } from "resend";

// Lazy init — hanya buat instance saat pertama dipakai
let resendInstance: Resend | null = null;

function getResend(): Resend {
  if (!resendInstance) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey || apiKey === "re_your_api_key_here") {
      throw new Error("RESEND_API_KEY belum dikonfigurasi di .env");
    }
    resendInstance = new Resend(apiKey);
  }
  return resendInstance;
}

const FROM = `${process.env.RESEND_FROM_NAME || "POS SaaS"} <${process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev"}>`;
const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "POS SaaS";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// ─────────────────────────────────────────────
// HELPER: kirim email dengan error handling
// ─────────────────────────────────────────────

async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  try {
    const resend = getResend();

    // Dev mode: redirect semua email ke RESEND_DEV_TO jika diisi
    // Berguna saat belum punya domain terverifikasi di Resend
    const devTo = process.env.RESEND_DEV_TO;
    const recipient = devTo || options.to;
    const subject = devTo
      ? `[DEV → ${options.to}] ${options.subject}`
      : options.subject;

    const { error } = await resend.emails.send({
      from: FROM,
      to: recipient,
      subject,
      html: options.html,
    });
    if (error) {
      console.error("Resend error:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Email send error:", err);
    return false;
  }
}

// ─────────────────────────────────────────────
// TEMPLATE BASE
// ─────────────────────────────────────────────

function baseTemplate(content: string): string {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${APP_NAME}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
          <!-- Header -->
          <tr>
            <td style="background:#2563eb;border-radius:12px 12px 0 0;padding:28px 32px;text-align:center;">
              <span style="color:#fff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">${APP_NAME}</span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="background:#fff;padding:32px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb;border-top:none;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 0;text-align:center;">
              <p style="margin:0;color:#9ca3af;font-size:12px;">
                Email ini dikirim oleh ${APP_NAME} · <a href="${APP_URL}" style="color:#6b7280;text-decoration:none;">${APP_URL}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function btn(text: string, url: string): string {
  return `<a href="${url}" style="display:inline-block;background:#2563eb;color:#fff;font-weight:600;font-size:14px;padding:12px 28px;border-radius:8px;text-decoration:none;margin:20px 0;">${text}</a>`;
}

function divider(): string {
  return `<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />`;
}

function infoRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:6px 0;color:#6b7280;font-size:14px;width:40%;">${label}</td>
    <td style="padding:6px 0;color:#111827;font-size:14px;font-weight:500;">${value}</td>
  </tr>`;
}

// ─────────────────────────────────────────────
// 1. SELAMAT DATANG (setelah registrasi)
// ─────────────────────────────────────────────

export async function sendWelcomeEmail(opts: {
  to: string;
  ownerName: string;
  storeName: string;
  trialDays: number;
}): Promise<boolean> {
  const html = baseTemplate(`
    <h2 style="margin:0 0 8px;color:#111827;font-size:20px;">Selamat datang, ${opts.ownerName}! 🎉</h2>
    <p style="margin:0 0 20px;color:#6b7280;font-size:15px;line-height:1.6;">
      Toko <strong>${opts.storeName}</strong> berhasil terdaftar di ${APP_NAME}.
      Kamu mendapatkan masa trial <strong>${opts.trialDays} hari</strong> untuk mencoba semua fitur secara gratis.
    </p>
    <div style="background:#eff6ff;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
      <p style="margin:0;color:#1d4ed8;font-size:14px;font-weight:600;">Yang bisa kamu lakukan sekarang:</p>
      <ul style="margin:8px 0 0;padding-left:20px;color:#3b82f6;font-size:14px;line-height:1.8;">
        <li>Tambahkan produk dan kategori</li>
        <li>Mulai transaksi di halaman Kasir (POS)</li>
        <li>Undang kasir dan atur cabang</li>
        <li>Lihat laporan penjualan real-time</li>
      </ul>
    </div>
    ${btn("Mulai Sekarang →", `${APP_URL}/dashboard`)}
    ${divider()}
    <p style="margin:0;color:#9ca3af;font-size:13px;">
      Butuh bantuan? Balas email ini atau hubungi support kami.
    </p>
  `);

  return sendEmail({
    to: opts.to,
    subject: `Selamat datang di ${APP_NAME} — Toko ${opts.storeName} siap digunakan!`,
    html,
  });
}

// ─────────────────────────────────────────────
// 2. INVOICE PAID (pembayaran berhasil)
// ─────────────────────────────────────────────

export async function sendInvoicePaidEmail(opts: {
  to: string;
  ownerName: string;
  storeName: string;
  invoiceNumber: string;
  planName: string;
  amount: number;
  periodEnd: Date;
}): Promise<boolean> {
  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
  const formatDate = (d: Date) =>
    new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(d);

  const html = baseTemplate(`
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;background:#dcfce7;border-radius:50%;width:56px;height:56px;line-height:56px;font-size:28px;">✓</div>
    </div>
    <h2 style="margin:0 0 8px;color:#111827;font-size:20px;text-align:center;">Pembayaran Berhasil!</h2>
    <p style="margin:0 0 24px;color:#6b7280;font-size:15px;text-align:center;">
      Paket <strong>${opts.planName}</strong> untuk toko <strong>${opts.storeName}</strong> telah aktif.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <tbody>
        ${infoRow("No. Invoice", opts.invoiceNumber)}
        ${infoRow("Paket", opts.planName)}
        ${infoRow("Jumlah", formatCurrency(opts.amount))}
        ${infoRow("Aktif hingga", formatDate(opts.periodEnd))}
      </tbody>
    </table>
    ${btn("Lihat Dashboard →", `${APP_URL}/dashboard/billing`)}
    ${divider()}
    <p style="margin:0;color:#9ca3af;font-size:13px;">
      Simpan email ini sebagai bukti pembayaran. Terima kasih telah berlangganan ${APP_NAME}!
    </p>
  `);

  return sendEmail({
    to: opts.to,
    subject: `Pembayaran berhasil — ${opts.planName} aktif hingga ${new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(opts.periodEnd)}`,
    html,
  });
}

// ─────────────────────────────────────────────
// 3. TRIAL AKAN BERAKHIR (reminder H-3 & H-1)
// ─────────────────────────────────────────────

export async function sendTrialEndingEmail(opts: {
  to: string;
  ownerName: string;
  storeName: string;
  daysLeft: number;
  trialEndsAt: Date;
}): Promise<boolean> {
  const formatDate = (d: Date) =>
    new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(d);

  const urgency = opts.daysLeft <= 1 ? "⚠️ Besok" : `${opts.daysLeft} hari lagi`;

  const html = baseTemplate(`
    <h2 style="margin:0 0 8px;color:#111827;font-size:20px;">Trial kamu akan berakhir ${urgency}</h2>
    <p style="margin:0 0 20px;color:#6b7280;font-size:15px;line-height:1.6;">
      Halo <strong>${opts.ownerName}</strong>, masa trial toko <strong>${opts.storeName}</strong> akan berakhir pada
      <strong>${formatDate(opts.trialEndsAt)}</strong>.
    </p>
    <div style="background:#fef3c7;border-left:4px solid #f59e0b;border-radius:0 8px 8px 0;padding:14px 18px;margin-bottom:20px;">
      <p style="margin:0;color:#92400e;font-size:14px;">
        Setelah trial berakhir, akses ke fitur akan dibatasi. Upgrade sekarang untuk melanjutkan tanpa gangguan.
      </p>
    </div>
    <p style="margin:0 0 4px;color:#374151;font-size:14px;font-weight:600;">Pilihan paket tersedia:</p>
    <ul style="margin:8px 0 20px;padding-left:20px;color:#6b7280;font-size:14px;line-height:1.8;">
      <li><strong>Paket Pro</strong> — Produk unlimited, 5 kasir, laporan lengkap</li>
      <li><strong>Paket Enterprise</strong> — Semua fitur Pro + multi-cabang unlimited</li>
    </ul>
    ${btn("Pilih Paket Sekarang →", `${APP_URL}/dashboard/billing`)}
    ${divider()}
    <p style="margin:0;color:#9ca3af;font-size:13px;">
      Tidak ingin upgrade? Kamu tetap bisa menggunakan Paket Gratis dengan batasan 50 produk dan 1 kasir.
    </p>
  `);

  return sendEmail({
    to: opts.to,
    subject: `${urgency} — Trial ${APP_NAME} toko ${opts.storeName} akan berakhir`,
    html,
  });
}

// ─────────────────────────────────────────────
// 5. RESET PASSWORD
// ─────────────────────────────────────────────

export async function sendPasswordResetEmail(opts: {
  to: string;
  name: string;
  resetUrl: string;
}): Promise<boolean> {
  const html = baseTemplate(`
    <h2 style="margin:0 0 8px;color:#111827;font-size:20px;">Reset Password</h2>
    <p style="margin:0 0 20px;color:#6b7280;font-size:15px;line-height:1.6;">
      Halo <strong>${opts.name}</strong>, kami menerima permintaan untuk mereset password akun kamu.
      Klik tombol di bawah untuk membuat password baru.
    </p>
    <div style="text-align:center;margin:28px 0;">
      ${btn("Reset Password →", opts.resetUrl)}
    </div>
    <div style="background:#fef3c7;border-left:4px solid #f59e0b;border-radius:0 8px 8px 0;padding:14px 18px;margin-bottom:20px;">
      <p style="margin:0;color:#92400e;font-size:13px;">
        ⏱️ Link ini hanya berlaku selama <strong>1 jam</strong>. Jika kamu tidak meminta reset password, abaikan email ini.
      </p>
    </div>
    ${divider()}
    <p style="margin:0;color:#9ca3af;font-size:13px;">
      Jika tombol tidak berfungsi, salin dan tempel URL ini ke browser:<br/>
      <a href="${opts.resetUrl}" style="color:#6b7280;word-break:break-all;">${opts.resetUrl}</a>
    </p>
  `);

  return sendEmail({
    to: opts.to,
    subject: `Reset Password ${APP_NAME}`,
    html,
  });
}
// ─────────────────────────────────────────────

export async function sendLowStockEmail(opts: {
  to: string;
  ownerName: string;
  storeName: string;
  outletName: string;
  products: { name: string; stock: number; minStock: number; unit: string }[];
}): Promise<boolean> {
  const rows = opts.products
    .map(
      (p) => `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:14px;color:#111827;">${p.name}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:14px;text-align:center;">
          <span style="color:${p.stock === 0 ? "#dc2626" : "#d97706"};font-weight:600;">${p.stock} ${p.unit}</span>
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:14px;color:#6b7280;text-align:center;">${p.minStock} ${p.unit}</td>
      </tr>`
    )
    .join("");

  const html = baseTemplate(`
    <h2 style="margin:0 0 8px;color:#111827;font-size:20px;">⚠️ Peringatan Stok Menipis</h2>
    <p style="margin:0 0 20px;color:#6b7280;font-size:15px;line-height:1.6;">
      Halo <strong>${opts.ownerName}</strong>, terdapat <strong>${opts.products.length} produk</strong> di
      cabang <strong>${opts.outletName}</strong> (${opts.storeName}) yang stoknya di bawah batas minimum.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:24px;">
      <thead>
        <tr style="background:#f9fafb;">
          <th style="padding:10px 12px;text-align:left;font-size:13px;color:#6b7280;font-weight:600;">Produk</th>
          <th style="padding:10px 12px;text-align:center;font-size:13px;color:#6b7280;font-weight:600;">Stok Saat Ini</th>
          <th style="padding:10px 12px;text-align:center;font-size:13px;color:#6b7280;font-weight:600;">Stok Minimum</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    ${btn("Kelola Stok →", `${APP_URL}/dashboard/products`)}
    ${divider()}
    <p style="margin:0;color:#9ca3af;font-size:13px;">
      Kamu menerima email ini karena ada produk yang stoknya di bawah batas minimum yang kamu tetapkan.
    </p>
  `);

  return sendEmail({
    to: opts.to,
    subject: `⚠️ ${opts.products.length} produk stok menipis — ${opts.outletName} (${opts.storeName})`,
    html,
  });
}
