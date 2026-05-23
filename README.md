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
| Validation | Zod |
| Email | Resend |
| Offline Storage | Dexie.js (IndexedDB) |
| PWA | Service Worker manual |

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
- Diskon persentase / nominal (global per transaksi)
- **Diskon per produk** (nominal per item di keranjang)
- Tukar poin loyalitas pelanggan
- Tahan transaksi (hold) & restore
- Metode bayar dikonfigurasi per toko (CASH, QRIS, Transfer, Kartu)
- Cetak struk thermal (58mm/80mm) via popup window
- Unduh struk sebagai HTML
- Foto produk di grid kasir

### ⏱️ Manajemen Shift Kasir
- Buka shift dengan input kas awal
- Ringkasan transaksi & pendapatan real-time selama shift berjalan
- Tutup shift dengan input kas akhir
- Laporan otomatis per shift: total transaksi, pendapatan, tunai vs non-tunai
- Riwayat shift (Owner melihat semua, Kasir melihat milik sendiri)

### 📦 Manajemen Produk & Inventaris
- CRUD produk lengkap (nama, SKU auto-generate, barcode, harga beli/jual, kategori, foto)
- Stok per cabang via `OutletStock`
- **Halaman Inventaris terpadu** (`/dashboard/inventory`) dengan 4 tab:
  - **Stok Menipis** — daftar lengkap produk di bawah batas minimum, filter habis/menipis, refresh real-time
  - **Riwayat Mutasi Stok** — log semua perubahan stok (masuk, keluar, penyesuaian, penjualan, retur) dengan filter tipe & tanggal
  - **Stock Opname** — rekonsiliasi stok fisik vs sistem, input per produk, laporan selisih, catatan opname
  - **Penyesuaian Massal** — update stok banyak produk sekaligus (set/tambah/kurangi), quick apply ke semua produk
- **Warning stok di POS** — produk stok habis ditampilkan disabled (tidak bisa ditambah), badge "Habis"/"Menipis" di grid produk
- **Warning stok di keranjang** — alert merah jika quantity melebihi stok tersedia, alert oranye jika stok menipis
- Transfer stok antar cabang
- Soft delete produk
- Manajemen kategori (CRUD)
- Pagination halaman produk

### � Notifikasi Email (Resend)
- **Selamat datang** — dikirim otomatis saat tenant baru registrasi
- **Invoice paid** — konfirmasi pembayaran berhasil dengan detail paket & masa aktif
- **Trial akan berakhir** — reminder H-3 dan H-1 sebelum trial habis
- **Low stock alert** — daftar produk stok menipis per cabang
- Super Admin bisa trigger email manual dari halaman Konfigurasi Sistem
- Endpoint cron-ready: `POST /api/notifications/low-stock` dan `POST /api/notifications/trial-reminder`
- Owner dapat meretur transaksi yang sudah selesai
- Input alasan retur wajib diisi
- Opsi kembalikan stok — stok semua item dikembalikan ke cabang asal
- Poin loyalitas pelanggan otomatis dikurangi
- Transaksi berubah status menjadi `CANCELLED` dengan catatan alasan

### 📱 PWA & Offline Mode
- App bisa di-install ke homescreen Android/iOS (manifest + icons)
- Service Worker cache halaman POS, static assets, dan gambar produk
- **Offline transaction queue** — transaksi disimpan ke IndexedDB saat offline, sync otomatis saat internet kembali
- **Conflict resolution UI** — modal detail status semua transaksi offline, retry transaksi gagal
- **PIN offline** — Owner set PIN 6 digit untuk kasir, verifikasi lokal (bcrypt), sesi offline 8 jam
- **Stale data banner** — peringatan jika data produk sudah >24 jam saat offline
- **Offline fallback page** — halaman proper saat navigasi ke URL yang tidak di-cache
- Badge status sync di toolbar POS (pending/gagal/tersinkron)
- Auto-sync saat koneksi kembali online

### 👤 Loyalitas Pelanggan
- Sistem poin: dikonfigurasi per toko (default: 1 poin per Rp 10.000)
- Redeem poin: dikonfigurasi per toko (default: 1 poin = Rp 100 diskon)
- Pilih pelanggan langsung dari POS
- Pagination daftar pelanggan

### 📊 Laporan & Analitik
- Dashboard ringkasan (pendapatan hari ini, transaksi, stok menipis)
- Grafik tren pendapatan harian (line chart)
- Bar chart produk terlaris
- Tabel performa per kasir (transaksi, rata-rata, total pendapatan)
- Filter tanggal custom + quick preset (7/30/90 hari)
- Filter per cabang
- **Laporan Laba Kotor** — tab terpisah dengan tabel per produk: pendapatan, HPP, laba kotor, margin %
- Summary cards laba kotor: HPP total, laba kotor total, margin % keseluruhan (warna dinamis)
- `buyPrice` di-snapshot ke `TransactionItem` saat transaksi dibuat (akurat meski harga beli berubah)
- Ekspor laporan ke **Excel** (multi-sheet: Ringkasan, Transaksi, Detail Item, Laba Kotor) atau **CSV**

### 💳 Billing & Langganan (Tripay)
- 3 paket: Gratis, Pro, Enterprise — harga & fitur dikelola Super Admin dari database
- Checkout via Tripay (BRIVA, QRIS, e-wallet, dll)
- Webhook callback otomatis aktivasi paket
- Manual cek status pembayaran (untuk dev localhost)
- Upgrade paket langsung (Pro → Enterprise)
- Downgrade terjadwal (efektif saat masa aktif berakhir)
- Perpanjang paket yang sama (extend masa aktif)

### 🔒 Keamanan & Enforcement
- Password di-hash dengan bcrypt (cost 12)
- JWT token dengan polling status setiap 5 menit
- Tenant suspended → auto logout + blokir login dengan pesan custom
- Tenant expired → redirect ke halaman billing
- Middleware edge-safe (tanpa Prisma di edge runtime)
- Tenant isolation di semua query
- **Zod validation** di semua API endpoint (runtime type safety)
- Server membuat nomor invoice dan menghitung ulang harga, total, pajak, kembalian, dan metode bayar transaksi POS dari data produk/toko
- Upload gambar membatasi folder, tipe, ukuran, serta izin upload produk/logo sesuai role
- Atomic stock deduction untuk transaksi dan transfer stok (mencegah oversell saat transaksi bersamaan)
- Retur diproses satu kali secara atomik dan membalik poin dari snapshot transaksi
- Idempotent webhook (mencegah duplikasi aktivasi paket)
- **Rate limiting brute force** — in-memory sliding window di semua endpoint auth (login, register, forgot/reset password)
- **Reset password via email** — token 32 bytes, expire 1 jam, satu kali pakai
- **Konfirmasi email** — tenant baru wajib verifikasi email sebelum dianggap terverifikasi

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
│   │       ├── inventory/   # Inventaris (Stok Menipis, Mutasi, Opname, Bulk Adj)
│   │       ├── transactions/# Riwayat Transaksi + Reprint + Retur
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
│       ├── shifts/          # Manajemen shift kasir
│       ├── transactions/
│       │   └── [id]/refund/ # Retur transaksi
│       ├── stock-mutations/ # Riwayat & penyesuaian stok (+ /bulk)
│       ├── stock-opname/    # Stock opname (rekonsiliasi fisik vs sistem)
│       ├── inventory/
│       │   └── low-stock/   # Daftar produk stok menipis/habis
│       ├── offline/
│       │   ├── sync-data/        # Sync produk+config ke IndexedDB
│       │   ├── sync-transactions/# Batch sync transaksi offline
│       │   └── set-pin/          # Set/get PIN offline kasir
│       └── ...
├── components/
│   ├── layout/              # Sidebar, Header, Outlet Switcher
│   ├── pos/                 # POS Interface, Cart, Payment, Receipt, ShiftModal
│   ├── products/            # Product Form Modal (dengan upload foto)
│   ├── customers/           # Customer Form Modal
│   ├── outlets/             # Outlet Form Modal, Transfer Stock Modal
│   ├── staff/               # Staff Form Modal
│   ├── billing/             # Checkout Modal
│   ├── transactions/        # Refund Modal
│   ├── pwa/                 # PWA: OfflineIndicator, SyncStatus, PinModal, ConflictModal
│   ├── super-admin/         # Super Admin components
│   └── ui/                  # Shared: Toaster, Pagination, ImageUpload, NoTenant
├── lib/
│   ├── auth.ts              # NextAuth full config (server)
│   ├── auth-config.ts       # NextAuth minimal config (edge/middleware)
│   ├── prisma.ts            # Prisma client singleton
│   ├── plans.ts             # Plan pricing dari database (1 query)
│   ├── schemas.ts           # Zod schemas terpusat + parseBody helper
│   ├── platform-config.ts   # Platform config (key-value store)
│   ├── tripay.ts            # Tripay API helper
│   ├── billing-actions.ts   # Shared billing logic
│   ├── active-outlet.ts     # Resolve outlet aktif dari session
│   ├── hold-transactions.ts # Hold transaction via localStorage
│   ├── print-receipt.ts     # Generate & print struk
│   ├── offline-db.ts        # IndexedDB schema via Dexie.js
│   ├── offline-queue.ts     # Offline transaction queue manager
│   ├── offline-pin.ts       # PIN offline: save, verify, session
│   └── utils.ts             # Helper functions
├── stores/
│   └── cart-store.ts        # Zustand cart state
├── hooks/
│   ├── use-offline-sync.ts  # Sync produk+config ke IndexedDB
│   └── use-offline-queue.ts # Manage offline transaction queue
└── types/
    └── next-auth.d.ts       # NextAuth type extensions

public/
├── manifest.json            # PWA manifest
├── sw.js                    # Service Worker manual
├── offline.html             # Halaman fallback saat offline
└── icons/                   # PWA icons (SVG, semua ukuran)
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
# Diperlukan untuk npm start (production build lokal)
AUTH_URL="http://localhost:3000"
AUTH_TRUST_HOST=true

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

# Cron notification endpoints
CRON_SECRET="random-secret-for-cron-requests"
```

> **Rekomendasi database gratis untuk dev:** [Neon](https://neon.tech) — PostgreSQL serverless, free tier 0.5 GB.

> **Vercel Blob:** Buat store dengan akses **Public** (bukan Private) agar gambar bisa ditampilkan di browser. Free tier: 1GB storage, 10GB transfer.

### 3. Setup Database

```bash
# Jalankan migrasi
npm run db:migrate

# Generate Prisma client
npm run db:generate

# Seed data demo (pricing plans + akun demo + platform config)
npm run db:seed
```

### 4. Jalankan Dev Server

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000)

> **Catatan:** Setelah menjalankan `prisma migrate dev`, selalu jalankan `npm run db:generate` dengan dev server dalam keadaan **mati** terlebih dahulu. Windows mengunci file `query_engine-windows.dll.node` saat server berjalan.

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
           ├── CashierShifts (shift per kasir per outlet)
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
4. **Transaksi** → stok di-deduct dari OutletStock cabang aktif saja (atomic, mencegah oversell)
5. **Owner switch cabang** → semua data (produk, laporan, dashboard) ikut berubah
6. **Kasir** → terikat ke 1 cabang, tidak bisa switch

---

## Alur Shift Kasir

1. Kasir buka shift → input kas awal → shift status `OPEN`
2. Selama shift berjalan → semua transaksi tercatat
3. Kasir tutup shift → input kas akhir → sistem hitung ringkasan otomatis
4. Shift status `CLOSED` → laporan tersimpan permanen
5. Owner bisa melihat riwayat semua shift di halaman Laporan

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

### Resend (Email)

```env
RESEND_API_KEY="re_..."
RESEND_FROM_EMAIL="noreply@yourdomain.com"
RESEND_FROM_NAME="POS SaaS"
```

> Untuk dev/testing tanpa domain: gunakan `RESEND_FROM_EMAIL="onboarding@resend.dev"` (bawaan Resend, tidak perlu verifikasi domain).

### Cron Notifikasi

Endpoint `POST /api/notifications/low-stock` dan `POST /api/notifications/trial-reminder` menerima request cron dengan header `x-cron-secret` yang harus sama dengan `CRON_SECRET`. Trigger manual dari panel Super Admin memakai sesi Super Admin, bukan secret yang dikirim dari browser.

### VPS / Server

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

## PWA & Offline Mode

### Test PWA di Lokal

Service worker aktif di **production build** saja:

```bash
npm run build
npm start
```

Lalu buka `http://localhost:3000`, login, kunjungi `/dashboard/pos` agar halaman ter-cache.

### Setup PIN Offline

1. Login sebagai Owner → **Pengaturan** → scroll ke bawah → **PIN Offline Kasir**
2. Pilih kasir, input PIN 6 digit, klik **Simpan PIN Offline**
3. Hash PIN tersimpan di IndexedDB browser kasir

### Alur Offline

```
Online  → Sync data ke IndexedDB (produk, config, stok)
Offline → Kasir bisa transaksi → disimpan ke queue IndexedDB
        → Stok dikurangi secara optimistic di lokal
Online  → Auto-sync queue ke server (1.5 detik setelah koneksi kembali)
        → Toast notifikasi hasil sync
```

### Batasan Offline

- Data produk stale setelah **24 jam** — banner merah muncul
- Sesi PIN offline berlaku **8 jam** (1 shift)
- Transaksi FAILED bisa di-retry max **3x**
- Halaman yang bisa diakses offline: `/dashboard/pos` (harus pernah dikunjungi saat online)

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

### ✅ Fase 4 — Kualitas & Fitur Tambahan
- Zod validation di semua API endpoint
- Atomic stock deduction (mencegah oversell)
- Idempotent webhook billing
- Unique constraints (tripayReference, invoiceNumber, phone+tenantId)
- Optimasi query (N+1 SKU generation, getAllPlans single query)
- **Shift kasir** (buka/tutup shift, kas awal/akhir, laporan per shift)
- **Retur transaksi** (batalkan + kembalikan stok + reverse poin)
- **Diskon per produk** di POS
- Pagination pelanggan

### ✅ Fase 5 — Manajemen Inventaris Lengkap
- **Halaman Inventaris terpadu** dengan 4 tab (Stok Menipis, Riwayat Mutasi, Stock Opname, Penyesuaian Massal)
- **Warning stok di POS** — produk habis disabled, badge visual di grid produk
- **Warning stok di keranjang** — alert jika quantity melebihi stok atau stok menipis
- **API stock mutations** — endpoint riwayat mutasi dengan filter tipe & tanggal
- **API stock opname** — rekonsiliasi stok fisik vs sistem secara atomik
- **API bulk adjustment** — update stok massal dalam satu transaksi
- **API low-stock** — daftar produk di bawah minStock per outlet
- Dashboard "Stok Menipis" sekarang link ke halaman Inventaris

### ✅ Fase 6 — PWA & Offline Mode
- **Installable PWA** — manifest.json, icons, bisa di-install ke homescreen Android/iOS
- **Service Worker manual** (`public/sw.js`) — cache halaman POS, static assets, gambar
- **Offline fallback page** (`/offline.html`) — halaman proper saat navigasi offline, tombol kembali ke kasir, auto-redirect saat online
- **IndexedDB via Dexie.js** — schema: products, categories, tenantConfig, offlineQueue, offlinePins, offlineSession
- **Sync data ke IndexedDB** — produk, kategori, config tenant di-cache lokal (stale setelah 24 jam)
- **Offline transaction queue** — transaksi disimpan ke IndexedDB saat offline, sync otomatis saat online kembali
- **Conflict resolution** — transaksi FAILED bisa di-retry, modal detail status semua transaksi offline
- **PIN offline** — Owner set PIN 6 digit untuk kasir, verifikasi lokal via bcrypt, sesi offline 8 jam
- **Stale data banner** — peringatan merah jika data >24 jam saat offline
- **OfflineSyncStatus badge** — badge oranye/merah di toolbar POS, klik untuk sync atau lihat detail
- **PWA install prompt** — prompt install ke homescreen (Android native + instruksi iOS)
- **API offline** — `/api/offline/sync-data`, `/api/offline/sync-transactions`, `/api/offline/set-pin`

### ✅ Fase 7 — Varian Produk (SKU Matrix)
- **Schema baru**: `ProductVariantType`, `ProductVariantOption`, `ProductVariantSKU`, `OutletStockVariant`, `StockMutationVariant`
- Satu produk bisa punya banyak tipe varian (Ukuran, Warna, Rasa, dll)
- Setiap kombinasi opsi = 1 SKU dengan harga, stok, barcode, dan gambar sendiri
- **Form varian di halaman Produk** — toggle aktifkan varian, builder tipe+opsi, generate kombinasi otomatis, matriks SKU collapsible dengan harga/stok/gambar per varian
- **Variant Picker Modal** di POS — kasir pilih kombinasi varian sebelum tambah ke keranjang
- Badge "Varian" + harga mulai di grid produk POS
- Label varian tampil di keranjang (e.g. "M / Merah")
- Stok per SKU per outlet, atomic deduction saat transaksi
- Snapshot `variantLabel` di `TransactionItem` untuk riwayat transaksi
- API `GET/POST/DELETE /api/products/[id]/variants`
- Offline support: variant data di-sync ke IndexedDB, queue transaksi varian
- Backward compatible — produk lama tanpa varian tetap berjalan normal

### ✅ Fase 8 — Purchase Order / Penerimaan Barang
- **Schema baru**: `PurchaseOrder`, `PurchaseOrderItem`, enum `PurchaseOrderStatus` (DRAFT/ORDERED/PARTIAL/RECEIVED/CANCELLED), `StockMutationType.PURCHASE`
- Buat PO dengan daftar produk, qty, harga beli, nama supplier, estimasi tiba
- Status flow: Draft → Dipesan → Sebagian Diterima → Diterima / Dibatalkan
- **Penerimaan barang**: catat qty diterima per item, stok otomatis bertambah di `OutletStock`, harga beli produk diperbarui jika berubah
- `StockMutation` type `PURCHASE` dicatat untuk setiap penerimaan
- Progress bar penerimaan (qty diterima / qty dipesan)
- API: `GET/POST /api/purchase-orders`, `GET/PUT/DELETE /api/purchase-orders/[id]`, `POST /api/purchase-orders/[id]/receive`
- Halaman `/dashboard/purchase-orders` dengan filter status dan summary cards
- Sidebar: menu "Pembelian (PO)" dengan ikon Truck

### ✅ Fase 9 — Keamanan & Auth Lanjutan
- **Reset password via email** — token 32 bytes, expire 1 jam, atomic update, rate limit per IP + per email via DB
- **Konfirmasi email saat register** — email verifikasi dikirim otomatis, banner compact di dashboard untuk Owner yang belum verifikasi
- **Rate limiting brute force** — in-memory sliding window, diterapkan di semua endpoint auth:
  - Login: 10 percobaan per IP / 5 per email per 15 menit
  - Register: 5 akun per IP per jam
  - Forgot password: 5 request per IP per 15 menit + 3 per email per 15 menit (via DB)
  - Reset password: 10 percobaan per IP per 15 menit
  - Validasi token: 20 request per IP per 15 menit (soft limit)

### ✅ Fase 10 — Laporan Laba Kotor
- **`buyPrice` snapshot di `TransactionItem`** — harga beli di-capture saat transaksi dibuat, akurat meski harga beli produk berubah kemudian
- **Tab Laba Kotor** di halaman Laporan — tabel per produk: pendapatan, HPP, laba kotor, margin % dengan badge warna
- **6 summary cards** — Pendapatan, Transaksi, Rata-rata, HPP, Laba Kotor, Margin %
- **Export Excel** — sheet baru "Laba Kotor" + kolom HPP/Laba/Margin di sheet "Detail Item"
- Ringkasan export juga mencantumkan total HPP, laba kotor, dan margin %
- Mendukung produk varian (buyPrice per SKU di-snapshot)

### ✅ Fase 11 — Audit Log
- **Model `AuditLog`** di database — action, entity, entityId, entityName, changes (JSON diff), userId, tenantId
- **`src/lib/audit.ts`** — helper `logAudit()` fire-and-forget + `diffObjects()` untuk diff field yang berubah
- **Audit dicatat di**: Produk (create/update/delete), Kategori (create/update/delete), Karyawan (create/update/delete), Cabang (create/update/delete), Pengaturan toko (update)
- **Halaman `/dashboard/audit-log`** — tabel paginated dengan filter aksi, entitas, pengguna, dan rentang tanggal
- Detail perubahan UPDATE bisa di-expand: field apa yang berubah, nilai sebelum dan sesudah
- Menu "Log Aktivitas" di sidebar (OWNER only)
- API `GET /api/audit-log` dengan filter lengkap

### ✅ Fase 12 — Notifikasi In-App
- **Model `AppNotification`** — type (LOW_STOCK/NEW_TRANSACTION/SYSTEM), title, message, isRead, link, tenantId
- **`src/lib/notifications.ts`** — `createNotification()` fire-and-forget + `notifyLowStock()` helper
- **Trigger otomatis**: transaksi baru oleh kasir → notifikasi ke Owner; stok produk turun di bawah minStock setelah transaksi → notifikasi LOW_STOCK
- **Deduplication**: notifikasi LOW_STOCK yang sama tidak dibuat ulang dalam 1 jam
- **Polling 30 detik** via hook `useNotifications` — fetch `/api/notifications`
- **`NotificationBell`** di header — badge merah unread count, dropdown list notifikasi, klik untuk navigasi
- Tandai satu / semua notifikasi sebagai dibaca (optimistic update)
- API: `GET /api/notifications`, `PATCH /api/notifications/[id]/read`, `POST /api/notifications/read-all`
- Hanya tampil untuk OWNER (kasir tidak perlu notifikasi manajemen)

### 🔄 Backlog
- Notifikasi trial akan berakhir (sudah ada via email, bisa ditambah in-app)
- Promo rule otomatis (beli N gratis 1, diskon jika total > X)
- Customer display (layar pelanggan)

---

## Lisensi

MIT License — bebas digunakan dan dimodifikasi.
