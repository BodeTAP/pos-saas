"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  BarChart3,
  Settings,
  Users,
  UserCircle,
  CreditCard,
  ShoppingBag,
  Store,
  ChevronLeft,
  ChevronRight,
  History,
} from "lucide-react";
import { UserRole } from "@prisma/client";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles: UserRole[];
  exact?: boolean; // true = harus match persis, default true untuk parent route
}

// Menu untuk tenant dashboard (Owner & Kasir)
const tenantNavItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: ["OWNER"],
    exact: true,
  },
  {
    label: "Kasir (POS)",
    href: "/dashboard/pos",
    icon: ShoppingCart,
    roles: ["KASIR", "OWNER"],
    exact: true,
  },
  {
    label: "Riwayat Shift",
    href: "/dashboard/pos/history",
    icon: History,
    roles: ["KASIR"],
  },
  {
    label: "Produk",
    href: "/dashboard/products",
    icon: Package,
    roles: ["OWNER"],
  },
  {
    label: "Transaksi",
    href: "/dashboard/transactions",
    icon: ShoppingBag,
    roles: ["OWNER"],
  },
  {
    label: "Laporan",
    href: "/dashboard/reports",
    icon: BarChart3,
    roles: ["OWNER"],
  },
  {
    label: "Karyawan",
    href: "/dashboard/staff",
    icon: Users,
    roles: ["OWNER"],
  },
  {
    label: "Pelanggan",
    href: "/dashboard/customers",
    icon: UserCircle,
    roles: ["OWNER"],
  },
  {
    label: "Cabang",
    href: "/dashboard/outlets",
    icon: Store,
    roles: ["OWNER"],
  },
  {
    label: "Langganan",
    href: "/dashboard/billing",
    icon: CreditCard,
    roles: ["OWNER"],
  },
  {
    label: "Pengaturan",
    href: "/dashboard/settings",
    icon: Settings,
    roles: ["OWNER"],
  },
];

interface SidebarProps {
  role: UserRole;
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const filteredItems = tenantNavItems.filter((item) => item.roles.includes(role));

  return (
    <aside
      className={cn(
        "bg-white border-r border-gray-200 flex flex-col transition-all duration-300",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <ShoppingCart className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900">POS SaaS</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 ml-auto"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 py-4 px-2 space-y-1">
        {filteredItems.map((item) => {
          const Icon = item.icon;
          // Exact match jika flag exact true, atau jika ada child route dengan prefix sama
          // Untuk route biasa: match jika pathname === href atau pathname dimulai dengan href + "/"
          const isActive = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + "/");

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Version */}
      {!collapsed && (
        <div className="px-4 py-3 border-t border-gray-200">
          <p className="text-xs text-gray-400">v1.0.0 — MVP</p>
        </div>
      )}
    </aside>
  );
}
