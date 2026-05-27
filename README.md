# POS SaaS

Aplikasi kasir (Point of Sale) berbasis SaaS & multi-tenant untuk UMKM Indonesia. Dibangun dengan Next.js 16 App Router.

---

## Tech Stack

| Layer | Teknologi |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript |
| Database | PostgreSQL (Neon) via Prisma v6 |
| Auth | NextAuth.js v5 (JWT) |
| Styling | Tailwind CSS v4 |
| State | Zustand |
| Charts | Recharts |
| Payment | Tripay |
| Storage | Vercel Blob |
| Email | Resend |
| Offline | Dexie.js (IndexedDB) |
| PWA | Service Worker manual |

---

## Quick Start

### 1. Clone & Install
```bash
git clone https://github.com/BodeTAP/pos-saas.git
cd pos-saas
npm install
```

### 2. Environment Variables
Buat file `.env`:
```env
DATABASE_URL="postgresql://..."
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="min-32-chars-random-string"
AUTH_URL="http://localhost:3000"
AUTH_TRUST_HOST=true

TRIPAY_API_KEY="..."
TRIPAY_PRIVATE_KEY="..."
TRIPAY_MERCHANT_CODE="..."
TRIPAY_BASE_URL="https://tripay.co.id/api-sandbox"

BLOB_READ_WRITE_TOKEN="vercel_blob_rw_..."
NEXT_PUBLIC_APP_URL="http://localhost:3000"
CRON_SECRET="random-secret"
```

> **Vercel Blob:** Buat store dengan akses **Public** (bukan Private).

### 3. Setup Database
```bash
npm run db:migrate    # Jalankan migrasi
npm run db:seed       # Seed data demo
npm run dev           # Jalankan dev server
```

### 4. Akun Demo
| Role | Email | Password |
|---|---|---|
| Super Admin | superadmin@pos-saas.com | superadmin123 |
| Owner | owner@demo-toko.com | owner123 |
| Kasir | kasir@demo-toko.com | kasir123 |

---

## Fitur Utama

### Multi-Tenant & Multi-Cabang
- Setiap toko terisolasi via `tenantId`
- Multi-cabang dengan stok terpisah per cabang
- Transfer stok antar cabang

### Role-Based Access
| Role | Akses |
|---|---|
| **Super Admin** | Panel platform — kelola semua tenant, billing, paket |
| **Owner** | Dashboard toko lengkap |
| **Kasir** | POS + riwayat shift |

### Kasir (POS)
- Pencarian produk, filter kategori, scan barcode
- Varian produk (SKU matrix)
- Modifier / add-on menu (F&B)
- Diskon global & per item
- Tukar poin loyalitas
- Hold & restore transaksi
- Cetak struk thermal 58mm/80mm
- Offline mode dengan sync otomatis

### F&B (Kafe/Restoran)
- Manajemen meja (area, kapasitas, status real-time)
- Dua alur pembayaran:
  - **PAY_FIRST** — bayar dulu, baru dimasak (self-service/fast food)
  - **PAY_LATER** — pesan dulu, bayar belakangan (kafe tradisional)
- Kitchen Display System — update status item per meja (Antri → Dimasak → Siap → Disajikan)
- Takeaway tampil di Kitchen Display
- Modifier/add-on dengan validasi server (kepedasan, suhu, ukuran)
- Service charge per toko
- Struk dapur (tanpa harga)
- Ketersediaan menu harian (toggle tanpa ubah stok)

### Inventaris
- Stok per cabang, mutasi stok, stock opname
- Purchase Order dari supplier
- Alert stok menipis

### Laporan
- Tren pendapatan harian, produk terlaris, performa kasir
- Laba kotor per produk (HPP snapshot saat transaksi)
- Laporan F&B: revenue per area, menu terlaris, rata-rata durasi duduk
- Export Excel / CSV

### Billing (Tripay)
- Paket FREE / PRO / ENTERPRISE
- Checkout otomatis via Tripay
- Upgrade, downgrade terjadwal, perpanjang

### PWA & Offline
- Installable ke homescreen Android/iOS
- Transaksi offline → queue IndexedDB → sync otomatis saat online
- PIN offline kasir (6 digit, sesi 8 jam)

### Lainnya
- Notifikasi in-app (stok menipis, transaksi baru)
- Audit log aktivitas
- Reset password via email
- Rate limiting brute force
- Error boundary + loading skeleton

---

## Struktur Proyek

```
src/
├── app/
│   ├── (auth)/              # Login, Register
│   ├── (dashboard)/         # Area tenant
│   │   └── dashboard/
│   │       ├── pos/         # Kasir + Riwayat Shift
│   │       ├── tables/      # Manajemen Meja (F&B)
│   │       ├── kitchen/     # Kitchen Display (F&B)
│   │       ├── modifiers/   # Modifier Menu (F&B)
│   │       ├── menu-availability/ # Ketersediaan Menu (F&B)
│   │       ├── products/    # Produk + Varian
│   │       ├── inventory/   # Stok, Mutasi, Opname
│   │       ├── purchase-orders/ # PO Supplier
│   │       ├── transactions/# Riwayat + Reprint + Retur
│   │       ├── reports/     # Laporan + F&B
│   │       ├── customers/   # Pelanggan & Poin
│   │       ├── staff/       # Karyawan
│   │       ├── outlets/     # Cabang + Transfer Stok
│   │       ├── billing/     # Langganan
│   │       └── settings/    # Pengaturan Toko
│   ├── (super-admin)/       # Panel Platform
│   └── api/                 # API Routes
├── components/
│   ├── pos/                 # POS, Cart, Payment, Receipt, Kitchen
│   ├── layout/              # Sidebar, Header
│   └── ui/                  # Shared components
├── lib/                     # Utils, auth, prisma, offline, email
├── stores/                  # Zustand (cart)
└── hooks/                   # Offline sync, notifications
```

---

## Database Commands

```bash
npm run db:migrate    # Jalankan migrasi baru
npm run db:push       # Push schema tanpa migrasi (dev only)
npm run db:seed       # Seed data demo
npm run db:studio     # Buka Prisma Studio
npm run db:generate   # Generate ulang Prisma client
```

---

## Deployment

### Environment Production
```env
DATABASE_URL="postgresql://..."
NEXTAUTH_URL="https://yourdomain.com"
NEXTAUTH_SECRET="..."
TRIPAY_BASE_URL="https://tripay.co.id/api"
BLOB_READ_WRITE_TOKEN="..."
NEXT_PUBLIC_APP_URL="https://yourdomain.com"
RESEND_API_KEY="re_..."
RESEND_FROM_EMAIL="noreply@yourdomain.com"
```

### Vercel
Deploy langsung dari GitHub. Set environment variables di dashboard Vercel.

### VPS
```bash
npm run build
npm start
```

### Webhook Tripay
Set callback URL di dashboard Tripay:
```
https://yourdomain.com/api/billing/callback
```

---

## Arsitektur Multi-Tenant

**Single Database, Shared Schema** — semua query wajib filter `tenantId`:

```
Tenant ──┬── Users (Owner, Kasir)
         ├── Outlets (Cabang) ──── OutletStock (stok per cabang)
         ├── Products ──── Variants ──── ModifierGroups
         ├── Transactions ──── TransactionItems ──── Modifiers
         ├── Tables ──── TableOrders ──── OrderItems (F&B)
         └── BillingInvoices
```

---

## Alur F&B

### PAY_FIRST (default — self-service/fast food)
```
Pilih meja → Tambah item → Bayar
→ OrderItem dibuat otomatis → Kitchen Display
→ Dapur masak → Tandai SERVED
→ Semua SERVED → Meja otomatis EMPTY
```

### PAY_LATER (kafe/restoran tradisional)
```
Pilih meja → Tambah item → Kirim ke Dapur
→ Dapur masak → Tandai SERVED
→ Kasir klik Bayar → Meja EMPTY
```

### Takeaway (tanpa meja)
```
Tambah item → Bayar
→ OrderItem dibuat → Kitchen Display (section Takeaway)
→ Dapur masak → Tandai SERVED → Hilang dari display
```

---

## PWA & Offline

```bash
# Test PWA (hanya aktif di production build)
npm run build && npm start
```

**Alur offline:**
1. Online → data di-sync ke IndexedDB
2. Offline → transaksi masuk queue lokal
3. Online kembali → auto-sync ke server

**Batasan:** Data stale setelah 24 jam · PIN sesi 8 jam · Retry max 3x

---

## Lisensi

MIT License
