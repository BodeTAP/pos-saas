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
| File Storage | Vercel Blob |
| Toast | Sonner |

---

## Fitur Lengkap

### 🏪 Multi-Tenant & Multi-Cabang
- Setiap tenant (toko) terisolasi secara data via `tenantId`
- Dukungan multi-cabang (outlet) dengan stok terpisah per cabang
- Outlet switcher di header untuk Owner berpindah cabang
- Kasir terikat ke 1 cabang permanen
- Transfer stok antar cabang dengan log mutasi

### 👥 Role-Based Access Control
| Role | Akses |
|---|---|
| **Super Admin** | Panel platform — kelola semua tenant, billing global, analitik, manajemen paket, konfigurasi sistem |
| **Owner** | Dashboard toko, produk, kategori, transaksi, laporan, karyawan, pelanggan, cabang, langganan, pengaturan |
| **Kasir** | Halaman POS + riwayat shift harian sendiri |

### 🛒 Kasir (POS)
- Pencarian produk cepat (nama, SKU, barcode)
- Filter kategori
- Keranjang belanja real-time (Zustand)
- Diskon persentase / nominal
- Tukar poin loyalitas pelanggan
- Tahan transaksi (hold) & restore
- Metode bayar dikonfigurasi per toko (CASH, QRIS, Transfer, Kartu)
- Cetak struk thermal (58mm/80mm) via popup window
- Unduh struk sebagai HTML
- Foto produk di grid kasir

### 📦 Manajemen Produk & Inventaris
- CRUD produk lengkap (nama, SKU auto-generate, barcode, harga beli/jual, kategori, foto)
- Stok per cabang via `OutletStock`
- Low stock alert di dashboard
- Riwayat mutasi stok (masuk, keluar, penyesuaian, penjualan)
- Transfer stok antar cabang
- Soft delete produk
- Manajemen kategori (CRUD)
- Pagination halaman produk

### 👤 Loyalitas Pelanggan
- CRUD pelanggan (nama, telepon, email)
- Sistem poin: dikonfigurasi per toko (default: 1 poin per Rp 10.000)
- Redeem poin: dikonfigurasi per toko (default: 1 poin = Rp 100 diskon)
- Pilih pelanggan langsung dari POS

### 📊 Laporan & Analitik
- Dashboard ringkasan (pendapatan hari ini, transaksi, stok menipis)
- Grafik tren pendapatan harian (line chart)
- Bar chart produk terlaris
- **Tabel performa per kasir** (transaksi, rata-rata, total pendapatan)
- Filter tanggal custom + quick preset (7/30/90 hari)
- Filter per cabang
- Ekspor laporan ke **Excel** (multi-sheet: Ringkasan, Transaksi, Detail Item) atau **CSV**

### 💳 Billing & Langganan (Tripay)
- 3 paket: Gratis, Pro, Enterprise — harga & fitur dikelola Super Admin dari database
- Checkout via Tripay (BRIVA, QRIS, e-wallet, dll)
- Webhook callback otomatis aktivasi paket
- Manual cek status pembayaran (untuk dev localhost)
- Blokir upgrade paket berbeda saat masih aktif
- Perpanjang paket yang sama (extend masa aktif)

### 🔒 Keamanan & Enforcement
- Password di-hash dengan bcrypt (cost 12)
- JWT token dengan polling status setiap 5 menit
- Tenant suspended → auto logout + blokir login dengan pesan custom
- Tenant expired → redirect ke halaman billing
- Middleware edge-safe (tanpa Prisma di edge runtime)
- Tenant isolation di semua query
- Input validation di semua API endpoint

### ⚙️ Konfigurasi Admin

**Super Admin dapat mengkonfigurasi:**
- Nama platform & email support
- Durasi trial tenant baru (hari)
- Toggle registrasi tenant baru (on/off)
- Mode maintenance dengan pesan custom
- Pesan untuk tenant yang disuspend
- Paket langganan (harga, fitur, batas produk/kasir/cabang)
- Manajemen akun Super Admin lain

**Owner dapat mengkonfigurasi:**
- Informasi toko (nama, telepon, alamat, logo)
- PPN (%)
- Prefix nomor invoice (INV, TRX, dll)
- Metode pembayaran aktif (CASH/QRIS/Transfer/Kartu)
- Sistem poin loyalitas (belanja per poin & nilai per poin)
- Pengaturan struk (lebar, header/tagline, catatan)
- Manajemen kategori produk
- Manajemen kasir & penugasan cabang

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
│   │       ├── categories/  # Manajemen Kategori
│   │       ├── transactions/# Riwayat Transaksi + Reprint
│   │       ├── reports/     # Laporan + Grafik + Per Kasir + Ekspor
│   │       ├── staff/       # Manajemen Karyawan
│   │       ├── customers/   # Pelanggan & Poin
│   │       ├── outlets/     # Manajemen Cabang + Transfer Stok
│   │       ├── billing/     # Langganan & Tripay
│   │       └── settings/    # Pengaturan Toko Lengkap
│   ├── (super-admin)/       # Panel Internal Platform
│   │   └── super-admin/
│   │       ├── tenants/     # Kelola semua tenant + detail + suspend
│   │       ├── plans/       # Manajemen paket langganan
│   │       ├── billing/     # Billing global + filter
│   │       ├── analytics/   # Analitik platform + grafik
│   │       └── settings/    # Konfigurasi sistem + Super Admin
│   ├── suspended/           # Halaman akun suspended (auto-logout)
│   └── api/                 # API Routes
├── components/
│   ├── layout/              # Sidebar, Header, Outlet Switcher
│   ├── pos/                 # POS Interface, Cart, Payment, Receipt
│   ├── products/            # Product Form Modal (dengan upload foto)
│   ├── customers/           # Customer Form Modal
│   ├── outlets/             # Outlet Form Modal, Transfer Stock Modal
│   ├── staff/               # Staff Form Modal
│   ├── billing/             # Checkout Modal
│   ├── super-admin/         # Super Admin components
│   └── ui/                  # Shared: Toaster, Pagination, ImageUpload, NoTenant
├── lib/
│   ├── auth.ts              # NextAuth full config (server)
│   ├── auth-config.ts       # NextAuth minimal config (edge/middleware)
│   ├── prisma.ts            # Prisma client singleton
│   ├── plans.ts             # Plan pricing dari database
│   ├── platform-config.ts   # Platform config (key-value store)
│   ├── tripay.ts            # Tripay API helper
│   ├── billing-actions.ts   # Shared billing logic
│   ├── active-outlet.ts     # Resolve outlet aktif dari session
│   ├── hold-transactions.ts # Hold transaction via localStorage
│   ├── print-receipt.ts     # Generate & print struk
│   ├── validation.ts        # Input validation helpers
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

# Vercel Blob (untuk upload gambar produk & logo toko)
# Buat Blob Store PUBLIC di: https://vercel.com/dashboard → Storage → Blob
# PENTING: Pilih akses "Public" saat membuat store
BLOB_READ_WRITE_TOKEN="vercel_blob_rw_..."

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_APP_NAME="POS SaaS"
```

> **Rekomendasi database gratis untuk dev:** [Neon](https://neon.tech) — PostgreSQL serverless, free tier 0.5 GB.

> **Vercel Blob:** Buat store dengan akses **Public** (bukan Private) agar gambar bisa ditampilkan di browser. Free tier: 1GB storage, 10GB transfer.

### 3. Setup Database

```bash
# Jalankan migrasi
npm run db:migrate

# Seed data demo (pricing plans + akun demo + platform config)
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
           ├── Transactions (per outlet, per kasir)
           ├── Customers (shared antar cabang)
           ├── Categories
           └── BillingInvoices

Tenant B ──┬── Users
           └── ...

Platform ──┬── PlatformConfig (konfigurasi global)
           └── PricingPlan (paket FREE/PRO/ENTERPRISE)
```

**Aturan query:** Setiap query wajib menyertakan filter `tenantId`:
```typescript
prisma.product.findMany({ where: { tenantId: session.user.tenantId } })
```

---

## Alur Multi-Cabang

1. **Tambah produk** → OutletStock otomatis dibuat di semua cabang (stok awal hanya di cabang utama)
2. **Tambah cabang baru** → OutletStock dibuat untuk semua produk existing dengan stok 0
3. **Transfer stok** → UI di halaman Cabang, mencatat 2 StockMutation (OUT + IN)
4. **Transaksi** → stok di-deduct dari OutletStock cabang aktif saja
5. **Owner switch cabang** → semua data (produk, laporan, dashboard) ikut berubah
6. **Kasir** → terikat ke 1 cabang, tidak bisa switch

---

## Konfigurasi Platform (Super Admin)

| Key | Default | Keterangan |
|---|---|---|
| `platform_name` | POS SaaS | Nama platform di UI |
| `support_email` | support@pos-saas.com | Email support di halaman suspended |
| `trial_days` | 14 | Durasi trial tenant baru (hari) |
| `registration_enabled` | true | Toggle registrasi tenant baru |
| `maintenance_mode` | false | Mode maintenance (semua tenant tidak bisa login) |
| `maintenance_message` | - | Pesan yang ditampilkan saat maintenance |
| `suspended_message` | - | Pesan untuk tenant yang disuspend |

---

## Upload Gambar (Vercel Blob)

Untuk mengaktifkan upload gambar produk dan logo toko:

1. Buka [vercel.com/dashboard](https://vercel.com/dashboard) → Storage → Create → **Blob**
2. **PENTING:** Pilih akses **Public** (bukan Private) saat membuat store
3. Setelah dibuat, klik tab `.env.local` di bagian Quickstart
4. Copy `BLOB_READ_WRITE_TOKEN` ke file `.env`

Jika store sudah terlanjur dibuat sebagai Private, buat store baru dengan akses Public.

---

## Deployment (Production)

### Environment Production

```env
DATABASE_URL="postgresql://..."
NEXTAUTH_URL="https://yourdomain.com"
NEXTAUTH_SECRET="random-string-min-32-chars"
TRIPAY_BASE_URL="https://tripay.co.id/api"
TRIPAY_API_KEY="..."
TRIPAY_PRIVATE_KEY="..."
TRIPAY_MERCHANT_CODE="..."
BLOB_READ_WRITE_TOKEN="vercel_blob_rw_..."
NEXT_PUBLIC_APP_URL="https://yourdomain.com"
```

### VPS Windows + Nginx

```bash
# Build
npm run build

# Start production server
npm start
```

Konfigurasi Nginx sebagai reverse proxy ke port 3000, aktifkan HTTPS via Let's Encrypt.

### Webhook Tripay (Production)

Set callback URL di Tripay dashboard:
```
https://yourdomain.com/api/billing/callback
```

Untuk development tanpa webhook, gunakan tombol **"Cek"** di halaman Langganan setelah melakukan pembayaran di Tripay sandbox.

---

## Roadmap

### ✅ Fase 1 — MVP
- Autentikasi multi-role + tenant isolation
- POS interface lengkap (cart, payment, receipt)
- CRUD produk + inventaris per cabang
- Cetak struk thermal (58mm/80mm)
- Manajemen kategori produk

### ✅ Fase 2 — SaaS & Komersialisasi
- Self-service onboarding tenant
- Integrasi Tripay (billing otomatis)
- Dashboard analitik + grafik (Recharts)
- Ekspor laporan Excel/CSV
- Manajemen kasir dengan penugasan cabang
- Laporan per kasir

### ✅ Fase 3 — Fitur Lanjutan
- Multi-cabang penuh (stok per outlet, outlet switcher, transfer stok)
- Sistem loyalitas pelanggan (poin reward + redeem, konfigurasi per toko)
- Hold transaction
- Filter tanggal di laporan
- Panel Super Admin lengkap (tenant management, plan management)
- Konfigurasi platform (maintenance mode, trial days, dll)
- Upload gambar produk & logo toko (Vercel Blob)
- Toast notifications (Sonner)
- Pagination

### 🔄 Backlog
- Konfirmasi email saat register (butuh email service)
- Reset password (butuh email service)
- Notifikasi low stock via email
- Audit log aktivitas
- Offline mode / PWA

---

## Lisensi

MIT License — bebas digunakan dan dimodifikasi.
