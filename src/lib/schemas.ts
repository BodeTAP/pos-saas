/**
 * Zod schemas terpusat untuk validasi request body di API routes.
 * Semua schema di sini dipakai bersama agar konsisten.
 */

import { z } from "zod";

// ─────────────────────────────────────────────
// HELPER: parse JSON body dan validasi dengan schema
// ─────────────────────────────────────────────

/**
 * Parse dan validasi request body dengan Zod schema.
 * Return { data } jika valid, { error, status } jika tidak.
 * Menggunakan discriminated union agar TypeScript bisa narrowing dengan benar.
 */
export async function parseBody<T>(
  req: Request,
  schema: z.ZodSchema<T>
): Promise<{ success: true; data: T } | { success: false; error: string; status: number }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { success: false, error: "Request body tidak valid (bukan JSON).", status: 400 };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    const firstError = result.error.errors[0];
    const field = firstError.path.join(".");
    const message = field
      ? `${field}: ${firstError.message}`
      : firstError.message;
    return { success: false, error: message, status: 400 };
  }

  return { success: true, data: result.data };
}

// ─────────────────────────────────────────────
// BILLING
// ─────────────────────────────────────────────

export const checkoutSchema = z.object({
  plan: z.enum(["PRO", "ENTERPRISE"], {
    errorMap: () => ({ message: "Paket tidak valid. Pilih PRO atau ENTERPRISE." }),
  }),
  period: z.enum(["MONTHLY", "YEARLY"], {
    errorMap: () => ({ message: "Periode tidak valid. Pilih MONTHLY atau YEARLY." }),
  }),
  paymentMethod: z.string().min(1, "Pilih metode pembayaran terlebih dahulu."),
});

export const downgradeSchema = z.object({
  plan: z.enum(["PRO", "FREE"], {
    errorMap: () => ({ message: "Paket downgrade tidak valid. Pilih PRO atau FREE." }),
  }),
});

// ─────────────────────────────────────────────
// TRANSAKSI
// ─────────────────────────────────────────────

const transactionItemSchema = z.object({
  productId: z.string().cuid("ID produk tidak valid."),
  productName: z.string().min(1, "Nama produk wajib diisi."),
  productSku: z.string().optional(),
  quantity: z.number().int().positive("Jumlah harus lebih dari 0."),
  unitPrice: z.number().nonnegative("Harga satuan tidak boleh negatif."),
  discount: z.number().nonnegative("Diskon tidak boleh negatif.").default(0),
  subtotal: z.number().nonnegative("Subtotal tidak boleh negatif."),
  // Varian (opsional)
  variantSkuId: z.string().cuid().optional().nullable(),
  variantLabel: z.string().max(200).optional().nullable(),
  // F&B: Modifier (opsional)
  modifiers: z
    .array(
      z.object({
        groupName: z.string().min(1).max(100),
        optionName: z.string().min(1).max(100),
        extraPrice: z.number().nonnegative().default(0),
      })
    )
    .optional()
    .default([]),
});

export const createTransactionSchema = z.object({
  // Invoice ditentukan server; field lama tetap diterima agar client lama tidak patah.
  invoiceNumber: z.string().min(1).optional(),
  items: z
    .array(transactionItemSchema)
    .min(1, "Transaksi harus memiliki minimal 1 item."),
  subtotal: z.number().nonnegative(),
  discount: z.number().nonnegative().default(0),
  discountPct: z.number().min(0).max(100).default(0),
  discountNominal: z.number().nonnegative().default(0),
  serviceChargePct: z.number().min(0).max(100).default(0), // F&B service charge
  tax: z.number().nonnegative().default(0),
  taxPct: z.number().min(0).max(100).default(0),
  total: z.number().positive("Total harus lebih dari 0."),
  amountPaid: z.number().nonnegative(),
  change: z.number().nonnegative().default(0),
  paymentMethod: z.enum(["CASH", "QRIS", "TRANSFER", "CARD", "OTHER"], {
    errorMap: () => ({ message: "Metode pembayaran tidak valid." }),
  }),
  note: z.string().max(500).optional().nullable(),
  customerId: z.string().cuid().optional().nullable(),
  pointsRedeemed: z.number().int().nonnegative().default(0),
  tenantId: z.string().cuid().optional(), // hanya untuk Super Admin
  tableOrderId: z.string().cuid().optional().nullable(), // F&B: link ke order meja
});

// ─────────────────────────────────────────────
// PRODUK
// ─────────────────────────────────────────────

export const createProductSchema = z.object({
  name: z
    .string()
    .min(1, "Nama produk wajib diisi.")
    .max(200, "Nama produk maksimal 200 karakter."),
  sku: z.string().max(50).optional().nullable(),
  barcode: z.string().max(100).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  imageUrl: z.string().url("URL gambar tidak valid.").optional().nullable(),
  buyPrice: z.number().nonnegative("Harga beli tidak boleh negatif.").default(0),
  sellPrice: z.number().positive("Harga jual harus lebih dari 0."),
  stock: z.number().int().nonnegative("Stok tidak boleh negatif.").default(0),
  minStock: z.number().int().nonnegative("Stok minimum tidak boleh negatif.").default(5),
  unit: z.string().max(20).default("pcs"),
  categoryId: z.string().cuid().optional().nullable(),
  isActive: z.boolean().default(true),
  hasVariants: z.boolean().default(false),
});

export const updateProductSchema = createProductSchema.partial().extend({
  isActive: z.boolean().optional(),
  hasVariants: z.boolean().optional(),
});

// ─────────────────────────────────────────────
// PENGATURAN TENANT
// ─────────────────────────────────────────────

const VALID_PAYMENT_METHODS = ["CASH", "QRIS", "TRANSFER", "CARD", "OTHER"] as const;

export const settingsSchema = z.object({
  name: z.string().min(1, "Nama toko wajib diisi.").max(100).optional(),
  phone: z.string().max(20).optional().nullable(),
  address: z.string().max(300).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  logoUrl: z.string().url("URL logo tidak valid.").optional().nullable(),
  taxRate: z
    .number()
    .min(0, "Tarif pajak tidak boleh negatif.")
    .max(100, "Tarif pajak maksimal 100%.")
    .optional(),
  receiptNote: z.string().max(300).optional().nullable(),
  receiptHeader: z.string().max(200).optional().nullable(),
  receiptWidth: z.union([z.literal(58), z.literal(80)]).optional(),
  invoicePrefix: z
    .string()
    .max(10)
    .regex(/^[A-Z0-9]*$/, "Prefix hanya boleh huruf kapital dan angka.")
    .optional(),
  pointsPerAmount: z
    .number()
    .int()
    .positive("Nilai poin per belanja harus lebih dari 0.")
    .optional(),
  pointValue: z
    .number()
    .int()
    .positive("Nilai tukar poin harus lebih dari 0.")
    .optional(),
  activePaymentMethods: z
    .array(z.enum(VALID_PAYMENT_METHODS))
    .min(1, "Minimal 1 metode pembayaran harus aktif.")
    .optional(),
  serviceChargePct: z
    .number()
    .min(0, "Service charge tidak boleh negatif.")
    .max(100, "Service charge maksimal 100%.")
    .optional(),
  paymentFlow: z.enum(["PAY_FIRST", "PAY_LATER"]).optional(),
});

// ─────────────────────────────────────────────
// STAFF / USER
// ─────────────────────────────────────────────

export const createUserSchema = z.object({
  name: z.string().min(1, "Nama wajib diisi.").max(100),
  email: z.string().email("Format email tidak valid."),
  password: z
    .string()
    .min(6, "Password minimal 6 karakter.")
    .max(100, "Password terlalu panjang."),
  role: z.enum(["OWNER", "KASIR"], {
    errorMap: () => ({ message: "Role tidak valid." }),
  }),
  outletId: z.string().cuid().optional().nullable(),
  isActive: z.boolean().default(true),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).max(100).optional(),
  role: z.enum(["OWNER", "KASIR"]).optional(),
  outletId: z.string().cuid().optional().nullable(),
  isActive: z.boolean().optional(),
});

// ─────────────────────────────────────────────
// PELANGGAN
// ─────────────────────────────────────────────

export const createCustomerSchema = z.object({
  name: z.string().min(1, "Nama pelanggan wajib diisi.").max(100),
  phone: z
    .string()
    .max(20)
    .regex(/^[0-9+\-\s()]*$/, "Format nomor telepon tidak valid.")
    .optional()
    .nullable(),
  email: z.string().email("Format email tidak valid.").optional().nullable(),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export const updateCustomerWithPointsSchema = updateCustomerSchema.extend({
  points: z.number().int().nonnegative("Poin tidak boleh negatif.").optional(),
});

// ─────────────────────────────────────────────
// KATEGORI
// ─────────────────────────────────────────────

export const categorySchema = z.object({
  name: z
    .string()
    .min(1, "Nama kategori wajib diisi.")
    .max(100, "Nama kategori maksimal 100 karakter."),
});

// ─────────────────────────────────────────────
// OUTLET
// ─────────────────────────────────────────────

export const createOutletSchema = z.object({
  name: z.string().min(1, "Nama cabang wajib diisi.").max(100),
  address: z.string().max(300).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  isActive: z.boolean().default(true),
});

export const updateOutletSchema = createOutletSchema.partial();
