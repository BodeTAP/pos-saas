/**
 * Validasi input API — helper functions
 */

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isPositiveNumber(value: unknown): boolean {
  const n = Number(value);
  return !isNaN(n) && n >= 0;
}

export function isPositiveInt(value: unknown): boolean {
  const n = Number(value);
  return !isNaN(n) && Number.isInteger(n) && n >= 0;
}

export function sanitizeString(value: unknown, maxLength = 255): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

export function validateProductInput(body: Record<string, unknown>): string | null {
  const { name, sellPrice, buyPrice, stock, minStock } = body;

  if (!name || typeof name !== "string" || !name.trim()) {
    return "Nama produk wajib diisi.";
  }
  if (name.toString().trim().length > 200) {
    return "Nama produk maksimal 200 karakter.";
  }
  if (sellPrice === undefined || sellPrice === null || sellPrice === "") {
    return "Harga jual wajib diisi.";
  }
  if (!isPositiveNumber(sellPrice)) {
    return "Harga jual harus berupa angka positif.";
  }
  if (buyPrice !== undefined && !isPositiveNumber(buyPrice)) {
    return "Harga beli harus berupa angka positif.";
  }
  if (stock !== undefined && !isPositiveInt(stock)) {
    return "Stok harus berupa bilangan bulat positif.";
  }
  if (minStock !== undefined && !isPositiveInt(minStock)) {
    return "Stok minimum harus berupa bilangan bulat positif.";
  }
  return null;
}

export function validateUserInput(body: Record<string, unknown>): string | null {
  const { name, email, password } = body;

  if (!name || typeof name !== "string" || !name.trim()) {
    return "Nama wajib diisi.";
  }
  if (!email || typeof email !== "string" || !isValidEmail(email)) {
    return "Format email tidak valid.";
  }
  if (password !== undefined) {
    if (typeof password !== "string" || password.length < 6) {
      return "Password minimal 6 karakter.";
    }
    if (password.length > 100) {
      return "Password terlalu panjang.";
    }
  }
  return null;
}
