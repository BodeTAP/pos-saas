import { handlers } from "@/lib/auth";
import { NextRequest } from "next/server";
import {
  rateLimit,
  getClientIp,
  rateLimitResponse,
  LOGIN_RATE_LIMIT,
  LOGIN_EMAIL_RATE_LIMIT,
} from "@/lib/rate-limit";

const { GET, POST: nextAuthPOST } = handlers;

/**
 * Wrap NextAuth POST dengan rate limiting untuk endpoint signin.
 * GET tidak perlu rate limit (hanya untuk session/csrf).
 */
async function POST(req: NextRequest) {
  const url = req.nextUrl.pathname;

  // Hanya rate limit endpoint signin credentials
  if (url.includes("/signin")) {
    const ip = getClientIp(req);

    // Rate limit per IP
    const ipResult = rateLimit(`login:ip:${ip}`, LOGIN_RATE_LIMIT);
    if (!ipResult.success) {
      return rateLimitResponse(
        ipResult.resetIn,
        `Terlalu banyak percobaan login. Coba lagi dalam ${ipResult.resetIn} detik.`
      );
    }

    // Rate limit per email (cek body tanpa consume stream)
    try {
      const cloned = req.clone();
      const body = await cloned.json().catch(() => ({}));
      const email = (body.email as string)?.trim().toLowerCase();

      if (email) {
        const emailResult = rateLimit(`login:email:${email}`, LOGIN_EMAIL_RATE_LIMIT);
        if (emailResult.success === false) {
          return rateLimitResponse(
            emailResult.resetIn,
            `Terlalu banyak percobaan untuk email ini. Coba lagi dalam ${emailResult.resetIn} detik.`
          );
        }
      }
    } catch {
      // Jika gagal parse body, lanjutkan saja
    }
  }

  return nextAuthPOST(req);
}

export { GET, POST };
