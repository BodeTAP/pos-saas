"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Package,
  ClipboardList,
  TrendingDown,
  ArrowUpDown,
  RefreshCw,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LowStockTab } from "./tabs/low-stock-tab";
import { StockMutationsTab } from "./tabs/stock-mutations-tab";
import { StockOpnameTab } from "./tabs/stock-opname-tab";
import { BulkAdjustmentTab } from "./tabs/bulk-adjustment-tab";

interface OutletInfo {
  id: string;
  name: string;
  isMain: boolean;
}

interface LowStockItem {
  productId: string;
  productName: string;
  productSku: string | null;
  productUnit: string;
  categoryName: string | null;
  stock: number;
  minStock: number;
  status: "OUT_OF_STOCK" | "LOW_STOCK";
}

interface InventoryClientProps {
  outlets: OutletInfo[];
  activeOutlet: OutletInfo | null;
  initialLowStockItems: LowStockItem[];
}

type TabId = "low-stock" | "mutations" | "opname" | "bulk-adjustment";

const tabs: { id: TabId; label: string; icon: React.ElementType; description: string }[] = [
  {
    id: "low-stock",
    label: "Stok Menipis",
    icon: AlertTriangle,
    description: "Produk di bawah batas minimum",
  },
  {
    id: "mutations",
    label: "Riwayat Mutasi",
    icon: ArrowUpDown,
    description: "Log semua perubahan stok",
  },
  {
    id: "opname",
    label: "Stock Opname",
    icon: ClipboardList,
    description: "Rekonsiliasi stok fisik vs sistem",
  },
  {
    id: "bulk-adjustment",
    label: "Penyesuaian Massal",
    icon: RefreshCw,
    description: "Update stok banyak produk sekaligus",
  },
];

export function InventoryClient({
  outlets,
  activeOutlet,
  initialLowStockItems,
}: InventoryClientProps) {
  const [activeTab, setActiveTab] = useState<TabId>("low-stock");
  const [selectedOutlet, setSelectedOutlet] = useState<OutletInfo | null>(activeOutlet);

  const outOfStockCount = initialLowStockItems.filter(
    (i) => i.status === "OUT_OF_STOCK"
  ).length;
  const lowStockCount = initialLowStockItems.filter(
    (i) => i.status === "LOW_STOCK"
  ).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Manajemen Inventaris</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Pantau dan kelola stok produk di semua cabang
          </p>
        </div>

        {/* Outlet Selector */}
        {outlets.length > 1 && (
          <div className="relative self-start sm:self-auto">
            <select
              value={selectedOutlet?.id ?? ""}
              onChange={(e) => {
                const outlet = outlets.find((o) => o.id === e.target.value);
                setSelectedOutlet(outlet ?? null);
              }}
              className="appearance-none pl-3 pr-8 py-2 border border-gray-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} {o.isMain ? "(Utama)" : ""}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div
          className={cn(
            "bg-white rounded-xl border p-4 cursor-pointer transition-all",
            activeTab === "low-stock"
              ? "border-orange-300 ring-2 ring-orange-100"
              : "border-gray-200 hover:border-orange-200"
          )}
          onClick={() => setActiveTab("low-stock")}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center">
              <Package className="w-4 h-4 text-red-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-red-600">{outOfStockCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">Stok Habis</p>
        </div>

        <div
          className={cn(
            "bg-white rounded-xl border p-4 cursor-pointer transition-all",
            activeTab === "low-stock"
              ? "border-orange-300 ring-2 ring-orange-100"
              : "border-gray-200 hover:border-orange-200"
          )}
          onClick={() => setActiveTab("low-stock")}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-orange-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-orange-600">{lowStockCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">Stok Menipis</p>
        </div>

        <div
          className={cn(
            "bg-white rounded-xl border p-4 cursor-pointer transition-all",
            activeTab === "mutations"
              ? "border-blue-300 ring-2 ring-blue-100"
              : "border-gray-200 hover:border-blue-200"
          )}
          onClick={() => setActiveTab("mutations")}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
              <ArrowUpDown className="w-4 h-4 text-blue-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-blue-600">
            <TrendingDown className="w-5 h-5 inline" />
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Riwayat Mutasi</p>
        </div>

        <div
          className={cn(
            "bg-white rounded-xl border p-4 cursor-pointer transition-all",
            activeTab === "opname"
              ? "border-purple-300 ring-2 ring-purple-100"
              : "border-gray-200 hover:border-purple-200"
          )}
          onClick={() => setActiveTab("opname")}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
              <ClipboardList className="w-4 h-4 text-purple-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-purple-600">
            <ClipboardList className="w-5 h-5 inline" />
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Stock Opname</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Tab Headers */}
        <div className="flex border-b border-gray-200 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                  activeTab === tab.id
                    ? "border-blue-600 text-blue-700 bg-blue-50/50"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="p-5">
          {activeTab === "low-stock" && (
            <LowStockTab
              initialItems={initialLowStockItems}
              selectedOutlet={selectedOutlet}
              outlets={outlets}
            />
          )}
          {activeTab === "mutations" && (
            <StockMutationsTab
              selectedOutlet={selectedOutlet}
              outlets={outlets}
            />
          )}
          {activeTab === "opname" && (
            <StockOpnameTab
              selectedOutlet={selectedOutlet}
              outlets={outlets}
            />
          )}
          {activeTab === "bulk-adjustment" && (
            <BulkAdjustmentTab
              selectedOutlet={selectedOutlet}
              outlets={outlets}
            />
          )}
        </div>
      </div>
    </div>
  );
}
