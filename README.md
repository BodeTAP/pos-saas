# POS SaaS — Sistem Kasir Modern untuk UMKM

Aplikasi Point of Sale (POS) berbasis **SaaS & Multi-Tenant** yang dibangun untuk membantu UMKM Indonesia mengelola transaksi penjualan, inventaris, dan analitik bisnis secara real-time.

---

## Tech Stack

| Komponen | Teknologi |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript |
| Database | PostgreSQL (Neon) |
| ORM | Prisma v6 |
| Auth | NextAuth.js v5 (JWT) |
| Styling | Tailwind CSS v4 |
| State Management | Zustand |
| Charts | Recharts |
| Export | xlsx |
| Payment Gateway | Tripay |

---

## Fitur Utama

### 🏪 Multi-Tenant & Multi-Cabang
- Setiap tenant (toko) terisolasi secara data via `tenantId`
- Dukungan multi-cabang (outlet) dengan stok terpisah per cabang
- Outlet switcher di header untuk Owner berpindah cabang
- Kasir terikat ke 1 cabang permanen

### 👥 Role-Based Access Control
| Role | Akses |
|---|---|
| **Super Admin** | Panel platform — kelola semua tenant, billing global, analitik, manajemen paket |
| **Owner** | Dashboard toko, produk, transaksi, laporan, karyawan, pelanggan, cabang, langganan |
| **Kasir** | Halaman POS + riwayat shift harian sendiri |

### 🛒 Kasir (POS)
- Pencarian produk cepat (nama, SKU, barcode)
- Filter kategori
- Keranjang belanja real-time (Zustand)
- Diskon persentase / nominal
- Tukar poin loyalitas pelanggan
- Tahan transaksi (hold) & restore
- Metode bayar: Tunai, QRIS, Transfer
- Cetak struk thermal (58mm/80mm) via popup window
- Unduh struk sebagai HTML

### 📦 Manajemen Produk & Inventaris
- CRUD produk lengkap (nama, SKU auto-generate, barcode, harga beli/jual, kategori)
- Stok per cabang via `OutletStock`
- Low stock alert di dashboard
- Riwayat mutasi stok (masuk, keluar, penyesuaian, penjualan)
- Soft delete produk

### 👤 Loyalitas Pelanggan
- CRUD pelanggan (nama, telepon, email)
- Sistem poin: 1 poin per Rp 10.000 belanja
- Redeem poin: 1 poin = Rp 100 diskon
- Pilih pelanggan langsung dari POS

### 📊 Laporan & Analitik
- Dashboard ringkasan (pendapatan hari ini, transaksi, stok menipis)
- Grafik tren pendapatan harian (line chart)
- Bar chart produk terlaris
- Filter tanggal custom + quick preset (7/30/90 hari)
- Ekspor laporan ke **Excel** (multi-sheet) atau **CSV**

### 💳 Billing & Langganan (Tripay)
- 3 paket: Gratis, Pro, Enterprise
- Harga & fitur paket dikelola Super Admin dari database
- Checkout via Tripay (BRIVA, QRIS, e-wallet, dll)
- Webhook callback otomatis aktivasi paket
- Manual cek status pembayaran (untuk dev localhost)
- Blokir upgrade paket berbeda saat masih aktif

### 🔒 Keamanan
- Password di-hash dengan bcrypt (cost 12)
- JWT token dengan refresh status setiap 5 menit
- Tenant suspended → auto logout + blokir login
- Middleware edge-safe (tanpa Prisma di edge runtime)
- Tenant isolation di semua query

---

## Struktur Proyek

```
src/
├── app/
│   ├── (auth)/              # Login, Register
│   ├── (dashboard)/         # Area tenant (Owner & Kasir)
│   │   └── dashboard/
│   │       ├── pos/         # Kasir + Riwayat Shift
│   │       ├── products/    # Manajemen Produk
│   │       ├── transactions/
│   │       ├── reports/     # Laporan + Grafik + Ekspor
│   │       ├── staff/       # Manajemen Karyawan
│   │       ├── customers/   # Pelanggan & Poin
│   │       ├── outlets/     # Manajemen Cabang
│   │       ├── billing/     # Langganan & Tripay
│   │       └── settings/    # Pengaturan Toko
│   ├── (super-admin)/       # Panel Internal Platform
│   │   └── super-admin/
│   │       ├── tenants/     # Kelola semua tenant + detail
│   │       ├── plans/       # Manajemen paket langganan
│   │       ├── billing/     # Billing global + filter
│   │       ├── analytics/   # Analitik platform
│   │       └── settings/    # Konfigurasi + Super Admin
│   ├── api/                 # API Routes
│   └── suspended/           # Halaman akun suspended
├── components/
│   ├── layout/              # Sidebar, Header, Outlet Switcher
│   ├── pos/                 # POS Interface, Cart, Payment, Receipt
│   ├── products/            # Product Form Modal
│   ├── customers/           # Customer Form Modal
│   ├── outlets/             # Outlet Form Modal
│   ├── staff/               # Staff Form Modal
│   ├── billing/             # Checkout Modal
│   └── super-admin/         # Super Admin components
├── lib/
│   ├── auth.ts              # NextAuth full config (server)
│   ├── auth-config.ts       # NextAuth minimal config (edge/middleware)
│   ├── prisma.ts            # Prisma client singleton
│   ├── plans.ts             # Plan pricing dari database
│   ├── tripay.ts            # Tripay API helper
│   ├── billing-actions.ts   # Shared billing logic
│   ├── active-outlet.ts     # Resolve outlet aktif dari session
│   ├── hold-transactions.ts # Hold transaction via localStorage
│   ├── print-receipt.ts     # Generate & print struk
│   └── utils.ts             # Helper functions
├── stores/
│   └── cart-store.ts        # Zustand cart state
└── types/
    └── next-auth.d.ts       # NextAuth type extensions
```

---

## Setup Development

### 1. Clone & Install

```bash
git clone https://github.com/BodeTAP/pos-saas.git
cd pos-saas
npm install
```

### 2. Konfigurasi Environment

Buat file `.env` di root proyek:

```env
# Database (PostgreSQL — rekomendasi: Neon)
DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-min-32-chars"

# Tripay Payment Gateway
TRIPAY_API_KEY="your-api-key"
TRIPAY_PRIVATE_KEY="your-private-key"
TRIPAY_MERCHANT_CODE="your-merchant-code"
TRIPAY_BASE_URL="https://tripay.co.id/api-sandbox"
# Production: TRIPAY_BASE_URL="https://tripay.co.id/api"

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_APP_NAME="POS SaaS"
```

> **Rekomendasi database gratis untuk dev:** [Neon](https://neon.tech) — PostgreSQL serverless, free tier 0.5 GB.

### 3. Setup Database

```bash
# Jalankan migrasi
npm run db:migrate

# Seed data demo (pricing plans + akun demo)
npm run db:seed
```

### 4. Jalankan Dev Server

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000)

---

## Akun Demo

| Role | Email | Password |
|---|---|---|
| Super Admin | superadmin@pos-saas.com | superadmin123 |
| Owner | owner@demo-toko.com | owner123 |
| Kasir | kasir@demo-toko.com | kasir123 |

---

## Database Commands

```bash
npm run db:migrate    # Jalankan migrasi baru
npm run db:push       # Push schema tanpa migrasi (dev only)
npm run db:seed       # Seed data demo
npm run db:studio     # Buka Prisma Studio (GUI database)
npm run db:generate   # Generate ulang Prisma client
```

---

## Arsitektur Multi-Tenant

Menggunakan **Single Database, Shared Schema** dengan isolasi data berbasis `tenantId`:

```
Tenant A ──┬── Users (Owner, Kasir)
           ├── Outlets (Cabang Utama, Cabang 2, ...)
           ├── Products ──── OutletStock (stok per cabang)
           ├── Transactions (per outlet)
           ├── Customers (shared antar cabang)
           └── BillingInvoices

Tenant B ──┬── Users
           └── ...
```

**Aturan query:** Setiap query wajib menyertakan filter `tenantId`:
```typescript
prisma.product.findMany({ where: { tenantId: session.user.tenantId } })
```

---

## Alur Multi-Cabang

1. **Tambah produk** → OutletStock otomatis dibuat di semua cabang (stok awal hanya di cabang utama)
2. **Tambah cabang baru** → OutletStock dibuat untuk semua produk existing dengan stok 0
3. **Transaksi** → stok di-deduct dari OutletStock cabang aktif saja
4. **Owner switch cabang** → semua data (produk, laporan, dashboard) ikut berubah
5. **Kasir** → terikat ke 1 cabang, tidak bisa switch

---

## Deployment (Production)

### VPS Windows + Nginx

```bash
# Build
npm run build

# Start production server
npm start
```

Konfigurasi Nginx sebagai reverse proxy ke port 3000, aktifkan HTTPS via Let's Encrypt.

### Environment Production

- Ganti `TRIPAY_BASE_URL` ke `https://tripay.co.id/api`
- Set `NEXTAUTH_URL` ke domain production
- Gunakan `NEXTAUTH_SECRET` yang kuat (min 32 karakter random)
- Pastikan `DATABASE_URL` mengarah ke database production

---

## Roadmap

### ✅ Fase 1 — MVP
- Autentikasi multi-role + tenant isolation
- POS interface lengkap (cart, payment, receipt)
- CRUD produk + inventaris per cabang
- Cetak struk thermal (58mm/80mm)

### ✅ Fase 2 — SaaS & Komersialisasi
- Self-service onboarding tenant
- Integrasi Tripay (billing otomatis)
- Dashboard analitik + grafik (Recharts)
- Ekspor laporan Excel/CSV
- Manajemen kasir dengan penugasan cabang

### ✅ Fase 3 — Fitur Lanjutan
- Multi-cabang penuh (stok per outlet, outlet switcher)
- Sistem loyalitas pelanggan (poin reward + redeem)
- Hold transaction
- Filter tanggal di laporan
- Panel Super Admin lengkap (tenant management, plan management)

---

## Lisensi

MIT License — bebas digunakan dan dimodifikasi.
