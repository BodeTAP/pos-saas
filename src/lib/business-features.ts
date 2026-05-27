/**
 * Feature flags dan konfigurasi UI per tipe bisnis.
 * Menentukan menu sidebar, label, dan fitur yang aktif.
 */

import { BusinessType } from "@prisma/client";

export interface BusinessFeatureConfig {
  /** Label untuk menu/halaman tertentu */
  labels: {
    products: string;       // "Produk" vs "Menu"
    inventory: string;      // "Inventaris" vs "Bahan Baku"
    purchaseOrders: string; // "Pembelian (PO)" vs "Pembelian Bahan"
    transactions: string;   // "Transaksi" vs "Order"
  };
  /** Fitur yang ditampilkan di sidebar */
  features: {
    purchaseOrders: boolean;  // PO dari supplier
    tableManagement: boolean; // Manajemen meja (F&B)
    kitchenDisplay: boolean;  // Kitchen Display System (F&B)
  };
  /** Deskripsi singkat untuk onboarding */
  description: string;
  /** Emoji untuk pilihan onboarding */
  emoji: string;
  /** Nama tampilan */
  displayName: string;
}

export const BUSINESS_FEATURES: Record<BusinessType, BusinessFeatureConfig> = {
  RETAIL: {
    displayName: "Retail",
    emoji: "🛍️",
    description: "Toko, warung, minimarket, atau bisnis yang menjual produk fisik",
    labels: {
      products: "Produk",
      inventory: "Inventaris",
      purchaseOrders: "Pembelian (PO)",
      transactions: "Transaksi",
    },
    features: {
      purchaseOrders: true,
      tableManagement: false,
      kitchenDisplay: false,
    },
  },
  FNB: {
    displayName: "F&B",
    emoji: "🍽️",
    description: "Kafe, restoran, warung makan, atau bisnis kuliner",
    labels: {
      products: "Menu",
      inventory: "Inventaris",
      purchaseOrders: "Pembelian Bahan",
      transactions: "Order",
    },
    features: {
      purchaseOrders: true,
      tableManagement: true,  // ✅ aktif
      kitchenDisplay: true,   // ✅ aktif
    },
  },
  SERVICE: {
    displayName: "Jasa/Servis",
    emoji: "💇",
    description: "Salon, laundry, bengkel, atau bisnis berbasis layanan",
    labels: {
      products: "Layanan",
      inventory: "Inventaris",
      purchaseOrders: "Pembelian",
      transactions: "Transaksi",
    },
    features: {
      purchaseOrders: false,
      tableManagement: false,
      kitchenDisplay: false,
    },
  },
  OTHER: {
    displayName: "Lainnya",
    emoji: "📦",
    description: "Tipe bisnis lainnya",
    labels: {
      products: "Produk",
      inventory: "Inventaris",
      purchaseOrders: "Pembelian (PO)",
      transactions: "Transaksi",
    },
    features: {
      purchaseOrders: true,
      tableManagement: false,
      kitchenDisplay: false,
    },
  },
};

/**
 * Ambil config fitur untuk tipe bisnis tertentu.
 * Fallback ke RETAIL jika tidak ditemukan.
 */
export function getBusinessFeatures(type: BusinessType): BusinessFeatureConfig {
  return BUSINESS_FEATURES[type] ?? BUSINESS_FEATURES.RETAIL;
}
