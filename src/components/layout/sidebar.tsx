"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, ShoppingCart, Package, BarChart3, Settings,
  Users, UserCircle, CreditCard, ShoppingBag, Store, Tag,
  ChevronLeft, ChevronRight, History, X, Warehouse, Truck,
  PanelLeftClose, PanelLeftOpen,
} from "lucide-react";
import { UserRole } from "@prisma/client";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles: UserRole[];
  exact?: boolean;
}

const tenantNavItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["OWNER"], exact: true },
  { label: "Kasir (POS)", href: "/dashboard/pos", icon: ShoppingCart, roles: ["KASIR", "OWNER"], exact: true },
  { label: "Riwayat Shift", href: "/dashboard/pos/history", icon: History, roles: ["KASIR"] },
  { label: "Produk", href: "/dashboard/products", icon: Package, roles: ["OWNER"] },
  { label: "Kategori", href: "/dashboard/categories", icon: Tag, roles: ["OWNER"] },
  { label: "Inventaris", href: "/dashboard/inventory", icon: Warehouse, roles: ["OWNER"] },
  { label: "Pembelian (PO)", href: "/dashboard/purchase-orders", icon: Truck, roles: ["OWNER"] },
  { label: "Transaksi", href: "/dashboard/transactions", icon: ShoppingBag, roles: ["OWNER"] },
  { label: "Laporan", href: "/dashboard/reports", icon: BarChart3, roles: ["OWNER"] },
  { label: "Karyawan", href: "/dashboard/staff", icon: Users, roles: ["OWNER"] },
  { label: "Pelanggan", href: "/dashboard/customers", icon: UserCircle, roles: ["OWNER"] },
  { label: "Cabang", href: "/dashboard/outlets", icon: Store, roles: ["OWNER"] },
  { label: "Langganan", href: "/dashboard/billing", icon: CreditCard, roles: ["OWNER"] },
  { label: "Pengaturan", href: "/dashboard/settings", icon: Settings, roles: ["OWNER"] },
];

interface SidebarProps {
  role: UserRole;
  isOpen?: boolean;
  onClose?: () => void;
}

// ── Desktop sidebar content ──────────────────────────────────
function DesktopNavContent({
  filteredItems,
  pathname,
  collapsed,
  setCollapsed,
}: {
  filteredItems: NavItem[];
  pathname: string;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className={cn(
          "h-16 flex items-center border-b border-gray-200 flex-shrink-0 px-3",
          collapsed ? "justify-center" : "justify-between px-4"
        )}
      >
        {!collapsed && (
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <ShoppingCart className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900 truncate">POS SaaS</span>
          </div>
        )}

        {collapsed && (
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <ShoppingCart className="w-4 h-4 text-white" />
          </div>
        )}

        <button
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? "Buka sidebar" : "Tutup sidebar"}
          className={cn(
            "flex items-center justify-center rounded-lg transition-colors text-gray-400 hover:text-gray-700 hover:bg-gray-100",
            collapsed ? "w-8 h-8 mt-2 mx-auto" : "w-8 h-8 flex-shrink-0"
          )}
        >
          {collapsed
            ? <PanelLeftOpen className="w-4 h-4" />
            : <PanelLeftClose className="w-4 h-4" />
          }
        </button>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 py-3 overflow-y-auto overflow-x-hidden">
        <ul className={cn("space-y-0.5", collapsed ? "px-2" : "px-2")}>
          {filteredItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(item.href + "/");

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  title={item.label}
                  className={cn(
                    "flex items-center rounded-lg text-sm font-medium transition-all duration-150 group relative",
                    collapsed
                      ? "justify-center w-10 h-10 mx-auto"
                      : "gap-3 px-3 py-2.5",
                    isActive
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  )}
                >
                  <Icon
                    className={cn(
                      "flex-shrink-0 transition-transform",
                      collapsed ? "w-5 h-5" : "w-4.5 h-4.5",
                      isActive ? "text-blue-600" : "text-gray-500 group-hover:text-gray-700"
                    )}
                  />
                  {!collapsed && <span className="truncate">{item.label}</span>}

                  {/* Tooltip saat collapsed */}
                  {collapsed && (
                    <span className="
                      absolute left-full ml-3 px-2.5 py-1.5 bg-gray-900 text-white text-xs
                      rounded-lg whitespace-nowrap opacity-0 pointer-events-none
                      group-hover:opacity-100 transition-opacity duration-150 z-50
                      shadow-lg
                    ">
                      {item.label}
                      <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900" />
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="px-4 py-3 border-t border-gray-100 flex-shrink-0">
          <p className="text-xs text-gray-400">v1.0.0 — MVP</p>
        </div>
      )}
    </div>
  );
}

// ── Mobile sidebar content ───────────────────────────────────
function MobileNavContent({
  filteredItems,
  pathname,
  onClose,
}: {
  filteredItems: NavItem[];
  pathname: string;
  onClose?: () => void;
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <ShoppingCart className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-gray-900">POS SaaS</span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 py-3 px-2 overflow-y-auto">
        <ul className="space-y-0.5">
          {filteredItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  )}
                >
                  <Icon className={cn("w-5 h-5 flex-shrink-0", isActive ? "text-blue-600" : "text-gray-500")} />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="px-4 py-3 border-t border-gray-100 flex-shrink-0">
        <p className="text-xs text-gray-400">v1.0.0 — MVP</p>
      </div>
    </div>
  );
}

// ── Main Sidebar ─────────────────────────────────────────────
export function Sidebar({ role, isOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const filteredItems = tenantNavItems.filter((item) => item.roles.includes(role));

  // Close mobile sidebar on route change
  useEffect(() => {
    onClose?.();
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 flex flex-col transition-transform duration-300 lg:hidden",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <MobileNavContent
          filteredItems={filteredItems}
          pathname={pathname}
          onClose={onClose}
        />
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden lg:flex bg-white border-r border-gray-200 flex-col transition-all duration-300 flex-shrink-0",
          collapsed ? "w-[4.5rem]" : "w-60"
        )}
      >
        <DesktopNavContent
          filteredItems={filteredItems}
          pathname={pathname}
          collapsed={collapsed}
          setCollapsed={setCollapsed}
        />
      </aside>
    </>
  );
}
