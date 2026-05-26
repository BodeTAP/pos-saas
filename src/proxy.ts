import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth-config";

// Edge-safe NextAuth instance (tanpa Prisma/bcrypt)
const { auth } = NextAuth(authConfig);

const publicRoutes = ["/login", "/register", "/api/auth", "/forgot-password", "/reset-password", "/verify-email"];

// Route yang HANYA boleh diakses Owner (Kasir diblokir)
const ownerOnlyRoutes = [
  "/dashboard/settings",
  "/dashboard/billing",
  "/dashboard/staff",
  "/dashboard/products",
  "/dashboard/categories",
  "/dashboard/inventory",
  "/dashboard/purchase-orders",
  "/dashboard/transactions",
  "/dashboard/reports",
  "/dashboard/customers",
  "/dashboard/outlets",
];

// Route yang tetap bisa diakses meski suspended
const suspendedAllowedRoutes = [
  "/dashboard/billing",
  "/api/billing",
];

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // Maintenance mode — cek header yang di-set oleh server (tidak bisa akses DB di edge)
  // Maintenance mode di-enforce di level API, bukan middleware
  // Karena middleware jalan di edge runtime tanpa akses DB

  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  if (!session) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role = session.user.role;
  const subscriptionStatus = session.user.subscriptionStatus;

  // ── SUPER ADMIN ──────────────────────────────────────────
  if (role === "SUPER_ADMIN") {
    if (pathname.startsWith("/dashboard")) {
      return NextResponse.redirect(new URL("/super-admin", req.url));
    }
    return NextResponse.next();
  }

  // ── SUSPENDED / EXPIRED ──────────────────────────────────
  if (
    subscriptionStatus === "SUSPENDED" ||
    subscriptionStatus === "EXPIRED"
  ) {
    const isAllowed =
      suspendedAllowedRoutes.some((r) => pathname.startsWith(r)) ||
      pathname === "/suspended";

    if (!isAllowed && (pathname.startsWith("/dashboard") || pathname === "/")) {
      return NextResponse.redirect(new URL("/suspended", req.url));
    }
    return NextResponse.next();
  }

  // ── KASIR ─────────────────────────────────────────────────
  if (role === "KASIR") {
    const isOwnerRoute = ownerOnlyRoutes.some(
      (route) => pathname === route || pathname.startsWith(route + "/")
    );
    const isDashboardRoot = pathname === "/dashboard";
    const isSuperAdmin = pathname.startsWith("/super-admin");

    if (isOwnerRoute || isDashboardRoot || isSuperAdmin) {
      return NextResponse.redirect(new URL("/dashboard/pos", req.url));
    }
    return NextResponse.next();
  }

  // ── OWNER ─────────────────────────────────────────────────
  if (role === "OWNER") {
    if (pathname.startsWith("/super-admin")) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Match semua path kecuali:
     * - _next/static (Next.js static files)
     * - _next/image (Next.js image optimization)
     * - favicon.ico
     * - File statis dengan ekstensi umum (gambar, font, manifest, sw)
     */
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot|json|js|css|txt|xml)$).*)",
  ],
};
