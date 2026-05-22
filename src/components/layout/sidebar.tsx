"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, ShoppingCart, Package, BarChart3, Settings,
  Users, UserCircle, CreditCard, ShoppingBag, Store, Tag,
  ChevronLeft, ChevronRight, History, X, Warehouse,
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

export function Sidebar({ role, isOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const filteredItems = tenantNavItems.filter((item) => item.roles.includes(role));

  // Close mobile sidebar on route change
  useEffect(() => {
    onClose?.();
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const navContent = (
    <>
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <ShoppingCart className="w-4 h-4 text-white" />
          </div>
          {!collapsed && <span className="font-bold text-gray-900">POS SaaS</span>}
        </div>
        {/* Desktop collapse button */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 ml-auto hidden lg:flex"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
        {/* Mobile close button */}
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 ml-auto lg:hidden"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {filteredItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="px-4 py-3 border-t border-gray-200 flex-shrink-0">
          <p className="text-xs text-gray-400">v1.0.0 — MVP</p>
        </div>
      )}
    </>
  );

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
        {navContent}
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden lg:flex bg-white border-r border-gray-200 flex-col transition-all duration-300",
          collapsed ? "w-16" : "w-60"
        )}
      >
        {navContent}
      </aside>
    </>
  );
}
