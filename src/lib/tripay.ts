import crypto from "crypto";

const TRIPAY_API_KEY = process.env.TRIPAY_API_KEY!;
const TRIPAY_PRIVATE_KEY = process.env.TRIPAY_PRIVATE_KEY!;
const TRIPAY_MERCHANT_CODE = process.env.TRIPAY_MERCHANT_CODE!;
const TRIPAY_BASE_URL = process.env.TRIPAY_BASE_URL || "https://tripay.co.id/api-sandbox";

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
  const data = `${TRIPAY_MERCHANT_CODE}${merchantRef}${amount}`;
  return crypto
    .createHmac("sha256", TRIPAY_PRIVATE_KEY)
    .update(data)
    .digest("hex");
}

/**
 * Verifikasi signature dari webhook callback Tripay
 * Tripay mengirim signature di header X-Callback-Signature
 */
export function verifyCallbackSignature(rawBody: string, signature: string): boolean {
  const expected = crypto
    .createHmac("sha256", TRIPAY_PRIVATE_KEY)
    .update(rawBody)
    .digest("hex");
  return expected === signature;
}

/**
 * Ambil daftar payment channel yang tersedia
 */
export async function getPaymentChannels(): Promise<TripayChannel[]> {
  const res = await fetch(`${TRIPAY_BASE_URL}/merchant/payment-channel`, {
    headers: {
      Authorization: `Bearer ${TRIPAY_API_KEY}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Tripay API error: ${res.status}`);
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
      Authorization: `Bearer ${TRIPAY_API_KEY}`,
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
  const res = await fetch(
    `${TRIPAY_BASE_URL}/transaction/detail?reference=${reference}`,
    {
      headers: {
        Authorization: `Bearer ${TRIPAY_API_KEY}`,
      },
      cache: "no-store",
    }
  );

  const data = await res.json();
  if (!data.success) {
    throw new Error(data.message || "Gagal mengambil status transaksi");
  }
  return data.data;
}
