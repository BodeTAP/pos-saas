import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Seed Pricing Plans (default)
  const defaultPlans = [
    {
      tier: "FREE" as const,
      name: "Paket Gratis",
      description: "Cocok untuk toko kecil yang baru memulai",
      monthlyPrice: 0,
      yearlyPrice: 0,
      maxProducts: 50,
      maxCashiers: 1,
      maxOutlets: 1,
      features: ["50 produk", "1 kasir", "Laporan dasar"],
    },
    {
      tier: "PRO" as const,
      name: "Paket Pro",
      description: "Untuk UMKM yang ingin berkembang",
      monthlyPrice: 149000,
      yearlyPrice: 1490000,
      maxProducts: 9999,
      maxCashiers: 5,
      maxOutlets: 1,
      features: [
        "Produk unlimited",
        "5 kasir",
        "Laporan lengkap + ekspor Excel/CSV",
        "Grafik analitik interaktif",
        "Prioritas support",
      ],
    },
    {
      tier: "ENTERPRISE" as const,
      name: "Paket Enterprise",
      description: "Solusi lengkap untuk bisnis dengan multi-cabang",
      monthlyPrice: 499000,
      yearlyPrice: 4990000,
      maxProducts: 99999,
      maxCashiers: 99,
      maxOutlets: 99,
      features: [
        "Semua fitur Pro",
        "Kasir unlimited",
        "Multi-cabang (multiple outlets)",
        "Dedicated support",
      ],
    },
  ];
  for (const plan of defaultPlans) {
    await prisma.pricingPlan.upsert({
      where: { tier: plan.tier },
      update: {},
      create: plan,
    });
  }
  console.log("✅ Pricing Plans:", defaultPlans.map((p) => p.tier).join(", "));

  // Buat Super Admin
  const superAdminPassword = await bcrypt.hash("superadmin123", 12);
  const superAdmin = await prisma.user.upsert({
    where: { email: "superadmin@pos-saas.com" },
    update: {},
    create: {
      name: "Super Admin",
      email: "superadmin@pos-saas.com",
      password: superAdminPassword,
      role: "SUPER_ADMIN",
    },
  });
  console.log("✅ Super Admin:", superAdmin.email);

  // Buat Demo Tenant
  const demoTenant = await prisma.tenant.upsert({
    where: { slug: "demo-toko" },
    update: {},
    create: {
      name: "Demo Toko",
      slug: "demo-toko",
      email: "owner@demo-toko.com",
      phone: "08123456789",
      address: "Jl. Contoh No. 1",
      city: "Jakarta",
      currency: "IDR",
      taxRate: 11, // PPN 11%
      receiptNote: "Terima kasih telah berbelanja!",
      plan: "PRO",
      subscriptionStatus: "ACTIVE",
      subscriptionEndsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 tahun
      maxProducts: 9999,
      maxCashiers: 5,
      maxOutlets: 1,
    },
  });
  console.log("✅ Demo Tenant:", demoTenant.name);

  // Buat outlet utama untuk demo tenant
  const mainOutlet = await prisma.outlet.upsert({
    where: { id: `${demoTenant.id}-main` },
    update: {},
    create: {
      id: `${demoTenant.id}-main`,
      name: "Cabang Utama",
      address: "Jl. Contoh No. 1, Jakarta",
      isMain: true,
      isActive: true,
      tenantId: demoTenant.id,
    },
  });
  console.log("✅ Outlet Utama:", mainOutlet.name);

  // Buat Owner untuk Demo Tenant
  const ownerPassword = await bcrypt.hash("owner123", 12);
  const owner = await prisma.user.upsert({
    where: { email: "owner@demo-toko.com" },
    update: {},
    create: {
      name: "Budi Santoso",
      email: "owner@demo-toko.com",
      password: ownerPassword,
      role: "OWNER",
      tenantId: demoTenant.id,
      outletId: mainOutlet.id,
    },
  });
  console.log("✅ Owner:", owner.email);

  // Buat Kasir untuk Demo Tenant
  const kasirPassword = await bcrypt.hash("kasir123", 12);
  const kasir = await prisma.user.upsert({
    where: { email: "kasir@demo-toko.com" },
    update: {},
    create: {
      name: "Siti Rahayu",
      email: "kasir@demo-toko.com",
      password: kasirPassword,
      role: "KASIR",
      tenantId: demoTenant.id,
      outletId: mainOutlet.id,
    },
  });
  console.log("✅ Kasir:", kasir.email);

  // Buat Kategori
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { name_tenantId: { name: "Minuman", tenantId: demoTenant.id } },
      update: {},
      create: { name: "Minuman", tenantId: demoTenant.id },
    }),
    prisma.category.upsert({
      where: { name_tenantId: { name: "Makanan", tenantId: demoTenant.id } },
      update: {},
      create: { name: "Makanan", tenantId: demoTenant.id },
    }),
    prisma.category.upsert({
      where: { name_tenantId: { name: "Snack", tenantId: demoTenant.id } },
      update: {},
      create: { name: "Snack", tenantId: demoTenant.id },
    }),
  ]);
  console.log("✅ Kategori:", categories.map((c: { name: string }) => c.name).join(", "));

  // Buat Produk Demo
  const products = [
    { name: "Kopi Hitam", sku: "KOP-001", buyPrice: 3000, sellPrice: 8000, stock: 100, categoryId: categories[0].id },
    { name: "Teh Manis", sku: "TEH-001", buyPrice: 2000, sellPrice: 6000, stock: 80, categoryId: categories[0].id },
    { name: "Es Jeruk", sku: "JRK-001", buyPrice: 4000, sellPrice: 10000, stock: 50, categoryId: categories[0].id },
    { name: "Air Mineral 600ml", sku: "AIR-001", buyPrice: 2500, sellPrice: 5000, stock: 200, categoryId: categories[0].id },
    { name: "Nasi Goreng", sku: "NSG-001", buyPrice: 10000, sellPrice: 20000, stock: 30, categoryId: categories[1].id },
    { name: "Mie Goreng", sku: "MIG-001", buyPrice: 8000, sellPrice: 18000, stock: 25, categoryId: categories[1].id },
    { name: "Roti Bakar", sku: "RTB-001", buyPrice: 5000, sellPrice: 12000, stock: 20, categoryId: categories[1].id },
    { name: "Keripik Singkong", sku: "KRP-001", buyPrice: 3000, sellPrice: 7000, stock: 60, categoryId: categories[2].id },
    { name: "Biskuit Coklat", sku: "BSK-001", buyPrice: 4000, sellPrice: 9000, stock: 45, categoryId: categories[2].id },
    { name: "Permen Mint", sku: "PRM-001", buyPrice: 1000, sellPrice: 3000, stock: 3, minStock: 10, categoryId: categories[2].id }, // Low stock
  ];

  for (const p of products) {
    const product = await prisma.product.upsert({
      where: { sku_tenantId: { sku: p.sku, tenantId: demoTenant.id } },
      update: {},
      create: {
        name: p.name,
        sku: p.sku,
        buyPrice: p.buyPrice,
        sellPrice: p.sellPrice,
        categoryId: p.categoryId,
        stock: p.stock, // default stock baseline
        minStock: p.minStock || 5,
        unit: "pcs",
        tenantId: demoTenant.id,
      },
    });

    // Buat stok di outlet utama
    await prisma.outletStock.upsert({
      where: {
        outletId_productId: { outletId: mainOutlet.id, productId: product.id },
      },
      update: {},
      create: {
        outletId: mainOutlet.id,
        productId: product.id,
        tenantId: demoTenant.id,
        stock: p.stock,
        minStock: p.minStock || 5,
      },
    });
  }
  console.log("✅ Produk:", products.length, "produk dibuat dengan stok awal");

  console.log("\n🎉 Seeding selesai!");
  console.log("\n📋 Akun Demo:");
  console.log("  Super Admin : superadmin@pos-saas.com / superadmin123");
  console.log("  Owner       : owner@demo-toko.com / owner123");
  console.log("  Kasir       : kasir@demo-toko.com / kasir123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
