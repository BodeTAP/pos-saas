import crypto from "crypto";

const TRIPAY_API_KEY = process.env.TRIPAY_API_KEY;
const TRIPAY_PRIVATE_KEY = process.env.TRIPAY_PRIVATE_KEY;
const TRIPAY_MERCHANT_CODE = process.env.TRIPAY_MERCHANT_CODE;
const TRIPAY_BASE_URL = process.env.TRIPAY_BASE_URL || "https://tripay.co.id/api-sandbox";

/**
 * Validasi env vars Tripay — throw di runtime jika tidak lengkap.
 * Dipanggil sebelum setiap operasi Tripay.
 */
function assertTripayConfig(): {
  apiKey: string;
  privateKey: string;
  merchantCode: string;
} {
  if (!TRIPAY_API_KEY || !TRIPAY_PRIVATE_KEY || !TRIPAY_MERCHANT_CODE) {
    throw new Error(
      "Konfigurasi Tripay tidak lengkap. Pastikan TRIPAY_API_KEY, TRIPAY_PRIVATE_KEY, dan TRIPAY_MERCHANT_CODE sudah diset di .env"
    );
  }
  return {
    apiKey: TRIPAY_API_KEY,
    privateKey: TRIPAY_PRIVATE_KEY,
    merchantCode: TRIPAY_MERCHANT_CODE,
  };
}

export interface TripayChannel {
  group: string;
  code: string;
  name: string;
  type: string;
  fee_merchant: { flat: number; percent: number };
  fee_customer: { flat: number; percent: number };
  total_fee: { flat: number; percent: string };
  minimum_fee: number;
  maximum_fee: number;
  icon_url: string;
  active: boolean;
}

export interface TripayOrderItem {
  sku?: string;
  name: string;
  price: number;
  quantity: number;
}

export interface CreateTransactionParams {
  method: string; // kode channel: BRIVA, MANDIRIVA, QRIS, dll
  merchantRef: string; // invoice number kita
  amount: number;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  orderItems: TripayOrderItem[];
  callbackUrl?: string;
  returnUrl?: string;
  expiredHours?: number; // default 24 jam
}

export interface TripayTransactionResponse {
  reference: string;
  merchant_ref: string;
  payment_selection_type: string;
  payment_method: string;
  payment_name: string;
  customer_name: string;
  customer_email: string;
  amount: number;
  fee_merchant: number;
  fee_customer: number;
  total_fee: number;
  amount_received: number;
  pay_code?: string;
  pay_url?: string;
  checkout_url: string;
  status: string;
  expired_time: number;
  qr_string?: string;
  qr_url?: string;
}

/**
 * Generate signature HMAC SHA-256
 * Format: merchantCode + merchantRef + amount → HMAC dengan privateKey
 */
export function generateSignature(merchantRef: string, amount: number): string {
  const { privateKey, merchantCode } = assertTripayConfig();
  const data = `${merchantCode}${merchantRef}${amount}`;
  return crypto
    .createHmac("sha256", privateKey)
    .update(data)
    .digest("hex");
}

/**
 * Verifikasi signature dari webhook callback Tripay.
 * Menggunakan timing-safe comparison untuk mencegah timing attack.
 */
export function verifyCallbackSignature(rawBody: string, signature: string): boolean {
  if (!signature) return false;
  const { privateKey } = assertTripayConfig();
  const expected = crypto
    .createHmac("sha256", privateKey)
    .update(rawBody)
    .digest("hex");

  // Timing-safe comparison — mencegah timing attack
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(signature, "hex")
    );
  } catch {
    // Buffer length mismatch (signature format salah)
    return false;
  }
}

/**
 * Ambil daftar payment channel yang tersedia
 */
export async function getPaymentChannels(): Promise<TripayChannel[]> {
  const { apiKey } = assertTripayConfig();
  const res = await fetch(`${TRIPAY_BASE_URL}/merchant/payment-channel`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Tripay API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  if (!data.success) {
    throw new Error(data.message || "Gagal mengambil channel pembayaran");
  }

  return data.data as TripayChannel[];
}

/**
 * Buat transaksi closed (nilai tetap) di Tripay
 * Untuk billing langganan SaaS — nilai sudah pasti per paket
 */
export async function createTransaction(
  params: CreateTransactionParams
): Promise<TripayTransactionResponse> {
  const { apiKey } = assertTripayConfig();
  const signature = generateSignature(params.merchantRef, params.amount);
  const expiredAt =
    Math.floor(Date.now() / 1000) + (params.expiredHours || 24) * 3600;

  const payload = {
    method: params.method,
    merchant_ref: params.merchantRef,
    amount: params.amount,
    customer_name: params.customerName,
    customer_email: params.customerEmail,
    customer_phone: params.customerPhone,
    order_items: params.orderItems,
    callback_url: params.callbackUrl,
    return_url: params.returnUrl,
    expired_time: expiredAt,
    signature,
  };

  const res = await fetch(`${TRIPAY_BASE_URL}/transaction/create`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  if (!res.ok || !data.success) {
    throw new Error(data.message || `Tripay error: ${res.status}`);
  }

  return data.data as TripayTransactionResponse;
}

/**
 * Cek status transaksi
 */
export async function getTransactionStatus(reference: string) {
  const { apiKey } = assertTripayConfig();
  const res = await fetch(
    `${TRIPAY_BASE_URL}/transaction/detail?reference=${encodeURIComponent(reference)}`,
    {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    throw new Error(`Tripay API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  if (!data.success) {
    throw new Error(data.message || "Gagal mengambil status transaksi");
  }
  return data.data;
}
