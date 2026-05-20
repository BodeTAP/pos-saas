---
inclusion: always
---

# POS SaaS — Konteks Proyek

## Deskripsi
Aplikasi Point of Sale (POS) berbasis SaaS & Multi-Tenant untuk UMKM Indonesia.

## Tech Stack
- **Framework**: Next.js 16 App Router + TypeScript
- **Database**: PostgreSQL + Prisma v7 ORM
- **Auth**: NextAuth.js v5 (JWT strategy)
- **Styling**: Tailwind CSS v4
- **State Management**: Zustand (untuk keranjang kasir)
- **Payment Gateway**: Tripay (Fase 2)

## Prisma v7 — Penting
- Generated client ada di `src/generated/prisma/client` (BUKAN `@prisma/client`)
- Import selalu dari `@/generated/prisma/client`
- `PrismaClient` wajib pakai driver adapter: `@prisma/adapter-pg`
- Contoh inisialisasi ada di `src/lib/prisma.ts`
- Next.js 15+ route params adalah `Promise`: `{ params }: { params: Promise<{ id: string }> }`

## Arsitektur Multi-Tenant
- **Strategi**: Single Database, Shared Schema
- **Isolasi**: Setiap query WAJIB menyertakan filter `tenantId`
- **Contoh**: `prisma.product.findMany({ where: { tenantId: session.user.tenantId } })`

## User Roles
- `SUPER_ADMIN` — Akses penuh ke semua tenant (internal platform)
- `OWNER` — Pemilik toko, akses penuh ke tenant sendiri
- `KASIR` — Hanya akses halaman POS (`/dashboard/pos`)

## Struktur Folder Penting
```
src/app/(auth)/          → Login, Register
src/app/(dashboard)/     → Semua halaman dashboard
src/app/api/             → API Routes
src/components/pos/      → Komponen kasir
src/components/products/ → Komponen produk
src/lib/auth.ts          → NextAuth config
src/lib/prisma.ts        → Prisma client singleton
src/lib/utils.ts         → Helper: formatCurrency, calculateTotal, dll
src/stores/cart-store.ts → Zustand cart state
```

## Formula Kalkulasi Transaksi (dari PRD)
```
Total Akhir = (Subtotal - Diskon) × (1 + %Pajak/100)
```

## Konvensi Kode
- Semua API route harus validasi `session.user.tenantId` sebelum query
- Soft delete untuk produk (set `isActive: false`), bukan hard delete
- Nomor invoice format: `INV-YYYYMMDD-XXXX`
- Password di-hash dengan bcrypt (cost factor 12)
- Semua komunikasi via HTTPS

## Database Commands
```bash
npm run db:migrate   # Jalankan migrasi
npm run db:seed      # Seed data demo
npm run db:studio    # Buka Prisma Studio
npm run db:push      # Push schema tanpa migrasi (dev only)
```
