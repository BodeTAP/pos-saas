import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth-config";
import { NextResponse } from "next/server";
import type { NextAuthRequest } from "next-auth";

const { auth } = NextAuth(authConfig);

/**
 * Middleware Next.js — berjalan di edge runtime (tanpa DB).
 * Validasi JWT token secara lokal, redirect sebelum Server Component dijalankan.
 * Menghilangkan satu round-trip DB untuk auth check di setiap request.
 */
export default auth((req: NextAuthRequest) => {
  const { pathname } = req.nextUrl;
  const user = req.auth?.user;

  // ── Rute publik — tidak perlu auth ──
  const publicPaths = ["/login", "/register", "/forgot-password", "/reset-password", "/verify-email"];
  const isPublic = publicPaths.some((p) => pathname.startsWith(p));
  const isApi = pathname.startsWith("/api/");
  const isStatic =
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/icons/") ||
    pathname === "/manifest.json" ||
    pathname === "/sw.js" ||
    pathname === "/offline.html";

  if (isPublic || isApi || isStatic) {
    return NextResponse.next();
  }

  // ── Tidak login → redirect ke login ──
  if (!user) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── Super Admin → hanya boleh akses /super-admin ──
  if (user.role === "SUPER_ADMIN") {
    if (!pathname.startsWith("/super-admin")) {
      return NextResponse.redirect(new URL("/super-admin", req.url));
    }
    return NextResponse.next();
  }

  // ── Non-super-admin mencoba akses /super-admin → redirect ke dashboard ──
  if (pathname.startsWith("/super-admin")) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // ── Tenant suspended → redirect ke suspended ──
  if (user.subscriptionStatus === "SUSPENDED" && !pathname.startsWith("/suspended")) {
    return NextResponse.redirect(new URL("/suspended", req.url));
  }

  // ── Tenant expired → redirect ke billing ──
  if (
    user.subscriptionStatus === "EXPIRED" &&
    !pathname.startsWith("/dashboard/billing") &&
    !pathname.startsWith("/suspended")
  ) {
    return NextResponse.redirect(new URL("/dashboard/billing", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Match semua path kecuali:
     * - _next/static, _next/image (Next.js internals)
     * - favicon.ico
     * - File statis dengan ekstensi umum
     */
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)$).*)",
  ],
};
