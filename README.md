# POS SaaS — Sistem Kasir Modern

Aplikasi Point of Sale berbasis SaaS & Multi-Tenant untuk UMKM Indonesia.

## Tech Stack

| Komponen | Teknologi |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript |
| Database | PostgreSQL |
| ORM | Prisma v7 |
| Auth | NextAuth.js v5 |
| Styling | Tailwind CSS v4 |
| State Kasir | Zustand |
| Payment | Tripay (Fase 2) |

## Struktur Proyek

```
src/
├── app/
│   ├── (auth)/          # Login, Register
│   ├── (dashboard)/     # Semua halaman dashboard
│   │   └── dashboard/
│   │       ├── page.tsx         # Dashboard utama
│   │       ├── pos/             # Halaman kasir
│   │       ├── products/        # Manajemen produk
│   │       ├── transactions/    # Riwayat transaksi
│   │       ├── reports/         # Laporan & analitik
│   │       ├── staff/           # Manajemen karyawan
│   │       ├── billing/         # Langganan & billing
│   │       └── settings/        # Pengaturan toko
│   └── api/             # API Routes
├── components/
│   ├── layout/          # Sidebar, Header
│   ├── pos/             # Komponen kasir
│   ├── products/        # Komponen produk
│   └── ui/              # Komponen UI dasar
├── lib/
│   ├── auth.ts          # NextAuth config
│   ├── prisma.ts        # Prisma client
│   └── utils.ts         # Helper functions
├── stores/
│   └── cart-store.ts    # Zustand cart state
└── types/
    └── next-auth.d.ts   # Type extensions
```

## Setup Development

### 1. Install dependencies
```bash
npm install
```

### 2. Setup database
Pastikan PostgreSQL berjalan, lalu update `.env`:
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/pos_saas_db"
NEXTAUTH_SECRET="your-secret-key"
```

### 3. Migrate database
```bash
npm run db:migrate
```

### 4. Seed data demo
```bash
npm run db:seed
```

### 5. Jalankan development server
```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000)

## Akun Demo

| Role | Email | Password |
|---|---|---|
| Super Admin | superadmin@pos-saas.com | superadmin123 |
| Owner | owner@demo-toko.com | owner123 |
| Kasir | kasir@demo-toko.com | kasir123 |

## Roadmap

### ✅ Fase 1 — MVP (Selesai)
- [x] Autentikasi multi-role (Super Admin, Owner, Kasir)
- [x] Multi-tenant dengan isolasi data via `tenantId`
- [x] Halaman kasir (POS) dengan keranjang real-time
- [x] Manajemen produk & inventaris (CRUD)
- [x] Riwayat transaksi
- [x] Laporan dasar
- [x] Pengaturan toko

### 🔄 Fase 2 — SaaS & Komersialisasi
- [ ] Self-service onboarding tenant baru
- [ ] Integrasi Tripay untuk billing langganan
- [ ] Dashboard analitik dengan grafik (Recharts)
- [ ] Ekspor laporan ke Excel/CSV
- [ ] Manajemen kasir (tambah/edit staff)

### 📋 Fase 3 — Fitur Lanjutan
- [ ] Multi-cabang per tenant
- [ ] Sistem loyalitas pelanggan
- [ ] Cetak struk thermal printer
- [ ] Offline mode (PWA)
