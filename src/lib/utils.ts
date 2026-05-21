import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format angka ke format mata uang Rupiah
 */
export function formatCurrency(amount: number, currency = "IDR"): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format tanggal ke format Indonesia
 */
export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}

/**
 * Format tanggal + waktu
 */
export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

/**
 * Generate nomor invoice dengan suffix waktu dan entropy UUID.
 */
export function generateInvoiceNumber(prefix = "INV"): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const time = now.getTime().toString(36).toUpperCase();
  const entropy = crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
  return `${prefix}-${date}-${time}-${entropy}`;
}

/**
 * Hitung total transaksi sesuai formula PRD:
 * Total Akhir = (Subtotal - Diskon) × (1 + %Pajak/100)
 */
export function calculateTotal(
  subtotal: number,
  discount: number,
  taxPct: number
): { afterDiscount: number; tax: number; total: number } {
  const afterDiscount = subtotal - discount;
  const tax = afterDiscount * (taxPct / 100);
  const total = afterDiscount + tax;
  return { afterDiscount, tax, total };
}

/**
 * Generate slug dari nama toko
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

/**
 * Generate prefix SKU dari nama produk
 * Ambil 3 huruf pertama dari kata pertama yang valid
 * Contoh: "Kopi Hitam" → "KOP", "Air Mineral 600ml" → "AIR"
 */
export function generateSKUPrefix(productName: string): string {
  // Ambil hanya huruf, abaikan angka dan simbol
  const cleaned = productName
    .toUpperCase()
    .replace(/[^A-Z\s]/g, "")
    .trim();

  if (!cleaned) return "PRD"; // fallback jika nama tidak punya huruf sama sekali

  const firstWord = cleaned.split(/\s+/)[0];
  // Pastikan minimal 3 karakter, padding dengan X jika kurang
  return (firstWord + "XXX").slice(0, 3);
}

/**
 * Format nomor urut SKU jadi 4 digit dengan leading zero
 * Contoh: 1 → "0001", 42 → "0042"
 */
export function formatSKUNumber(num: number): string {
  return String(num).padStart(4, "0");
}

/**
 * Truncate teks panjang
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}
