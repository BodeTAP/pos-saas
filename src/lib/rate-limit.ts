import { NextResponse } from "next/server";

/**
 * In-memory rate limiter menggunakan sliding window algorithm.
 *
 * Cocok untuk single-instance deployment (VPS, Vercel single region).
 * Untuk multi-instance, ganti dengan Redis-based rate limiter.
 *
 * Memory otomatis dibersihkan saat window expired.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number; // timestamp ms
}

// Map: key → entry
// Key biasanya: "endpoint:ip" atau "endpoint:email"
const store = new Map<string, RateLimitEntry>();

// Cleanup expired entries setiap 5 menit agar tidak memory leak
// Guard: hanya jalankan di Node.js runtime (bukan edge), dan hanya sekali
if (typeof setInterval !== "undefined" && typeof globalThis !== "undefined") {
  // Gunakan symbol di globalThis agar tidak double-register saat hot reload
  const CLEANUP_KEY = Symbol.for("__rate_limit_cleanup__");
  if (!(globalThis as Record<symbol, unknown>)[CLEANUP_KEY]) {
    (globalThis as Record<symbol, unknown>)[CLEANUP_KEY] = true;
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of store.entries()) {
        if (entry.resetAt <= now) store.delete(key);
      }
    }, 5 * 60 * 1000);
  }
}

export interface RateLimitConfig {
  /** Jumlah request maksimal dalam window */
  limit: number;
  /** Durasi window dalam detik */
  windowSec: number;
}

export interface RateLimitResult {
  success: boolean;
  /** Sisa request yang diizinkan */
  remaining: number;
  /** Waktu reset dalam detik dari sekarang */
  resetIn: number;
}

/**
 * Cek dan increment rate limit untuk key tertentu.
 * Return { success: false } jika limit terlampaui.
 */
export function rateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const windowMs = config.windowSec * 1000;

  const entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    // Window baru atau expired
    store.set(key, { count: 1, resetAt: now + windowMs });
    return {
      success: true,
      remaining: config.limit - 1,
      resetIn: config.windowSec,
    };
  }

  if (entry.count >= config.limit) {
    return {
      success: false,
      remaining: 0,
      resetIn: Math.ceil((entry.resetAt - now) / 1000),
    };
  }

  entry.count++;
  return {
    success: true,
    remaining: config.limit - entry.count,
    resetIn: Math.ceil((entry.resetAt - now) / 1000),
  };
}

/**
 * Ambil IP dari request Next.js.
 * Mendukung Vercel, Cloudflare, dan server biasa.
 */
export function getClientIp(req: Request): string {
  const headers = req.headers as Headers;
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

/**
 * Buat response 429 Too Many Requests yang konsisten.
 * Return NextResponse agar kompatibel dengan Next.js route handlers.
 */
export function rateLimitResponse(resetIn: number, message?: string): NextResponse {
  return NextResponse.json(
    {
      error: message || `Terlalu banyak percobaan. Coba lagi dalam ${resetIn} detik.`,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(resetIn),
        "X-RateLimit-Reset": String(Math.floor(Date.now() / 1000) + resetIn),
      },
    }
  );
}

// ─────────────────────────────────────────────
// PRESET CONFIGS
// ─────────────────────────────────────────────

/** Login: 10 percobaan per IP per 15 menit */
export const LOGIN_RATE_LIMIT: RateLimitConfig = {
  limit: 10,
  windowSec: 15 * 60,
};

/** Login per email: 5 percobaan per email per 15 menit */
export const LOGIN_EMAIL_RATE_LIMIT: RateLimitConfig = {
  limit: 5,
  windowSec: 15 * 60,
};

/** Register: 5 akun baru per IP per jam */
export const REGISTER_RATE_LIMIT: RateLimitConfig = {
  limit: 5,
  windowSec: 60 * 60,
};

/** Forgot password: 5 request per IP per 15 menit */
export const FORGOT_PASSWORD_RATE_LIMIT: RateLimitConfig = {
  limit: 5,
  windowSec: 15 * 60,
};

/** Reset password: 10 percobaan per IP per 15 menit */
export const RESET_PASSWORD_RATE_LIMIT: RateLimitConfig = {
  limit: 10,
  windowSec: 15 * 60,
};
