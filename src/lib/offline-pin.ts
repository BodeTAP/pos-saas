/**
 * Offline PIN manager.
 * Menyimpan hash PIN di IndexedDB untuk verifikasi saat offline.
 * PIN di-set oleh Owner, diverifikasi oleh Kasir saat session expired offline.
 */

import { getOfflineDB } from "@/lib/offline-db";

const OFFLINE_SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 jam (1 shift)

// ─────────────────────────────────────────────
// PIN MANAGEMENT
// ─────────────────────────────────────────────

/**
 * Simpan hash PIN ke IndexedDB (dipanggil saat online setelah Owner set PIN)
 */
export async function saveOfflinePin(
  userId: string,
  pinHash: string,
  expiresAt: string
): Promise<void> {
  try {
    const db = getOfflineDB();
    await db.offlinePins.put({
      userId,
      pinHash,
      expiresAt: new Date(expiresAt).getTime(),
    });
  } catch (err) {
    console.warn("Failed to save offline PIN:", err);
  }
}

/**
 * Verifikasi PIN offline menggunakan hash di IndexedDB.
 * Return true jika PIN cocok dan belum expired.
 */
export async function verifyOfflinePin(
  userId: string,
  pin: string
): Promise<{ valid: boolean; reason?: string }> {
  try {
    const db = getOfflineDB();
    const record = await db.offlinePins.get(userId);

    if (!record) {
      return { valid: false, reason: "PIN belum diset. Hubungi Owner." };
    }

    if (Date.now() > record.expiresAt) {
      // Bersihkan record expired agar tidak menumpuk
      await db.offlinePins.delete(userId).catch(() => {});
      return { valid: false, reason: "PIN sudah expired. Sambungkan internet untuk memperbarui." };
    }

    // Verifikasi hash menggunakan bcryptjs
    const { compare } = await import("bcryptjs");
    const isValid = await compare(pin, record.pinHash);

    return { valid: isValid, reason: isValid ? undefined : "PIN salah." };
  } catch (err) {
    console.warn("PIN verification error:", err);
    return { valid: false, reason: "Gagal memverifikasi PIN." };
  }
}

/**
 * Cek apakah user punya PIN offline yang valid
 */
export async function hasValidOfflinePin(userId: string): Promise<boolean> {
  try {
    const db = getOfflineDB();
    const record = await db.offlinePins.get(userId);
    if (!record) return false;
    return Date.now() <= record.expiresAt;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────
// OFFLINE SESSION
// ─────────────────────────────────────────────

/**
 * Buat sesi offline setelah PIN berhasil diverifikasi.
 * Sesi berlaku 8 jam (1 shift).
 */
export async function createOfflineSession(
  userId: string,
  cashierId: string,
  outletId: string
): Promise<void> {
  try {
    const db = getOfflineDB();
    await db.offlineSession.put({
      id: "current",
      userId,
      cashierId,
      outletId,
      startedAt: Date.now(),
      expiresAt: Date.now() + OFFLINE_SESSION_DURATION_MS,
    });
  } catch (err) {
    console.warn("Failed to create offline session:", err);
  }
}

/**
 * Cek apakah ada sesi offline yang masih valid
 */
export async function getActiveOfflineSession() {
  try {
    const db = getOfflineDB();
    const session = await db.offlineSession.get("current");
    if (!session) return null;
    if (Date.now() > session.expiresAt) {
      await db.offlineSession.delete("current");
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

/**
 * Hapus sesi offline (logout)
 */
export async function clearOfflineSession(): Promise<void> {
  try {
    const db = getOfflineDB();
    await db.offlineSession.delete("current");
  } catch {
    // Ignore
  }
}

/**
 * Sisa waktu sesi offline dalam menit
 */
export async function getOfflineSessionRemainingMinutes(): Promise<number> {
  const session = await getActiveOfflineSession();
  if (!session) return 0;
  return Math.max(0, Math.floor((session.expiresAt - Date.now()) / 60000));
}
