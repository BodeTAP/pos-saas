"use client";

import { signOut } from "next-auth/react";
import { UserRole } from "@prisma/client";
import { LogOut, User, ChevronDown, Menu } from "lucide-react";
import { useState } from "react";
import { OutletSwitcher } from "./outlet-switcher";

const roleLabel: Record<UserRole, string> = {
  SUPER_ADMIN: "Super Admin",
  OWNER: "Pemilik Toko",
  KASIR: "Kasir",
};

interface HeaderProps {
  user: { name: string; email: string; role: UserRole };
  onMenuClick?: () => void;
}

export function Header({ user, onMenuClick }: HeaderProps) {
  const [open, setOpen] = useState(false);

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-6 relative z-30 flex-shrink-0">
      <div className="flex items-center gap-3">
        {/* Hamburger — mobile only */}
        <button
          onClick={onMenuClick}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 lg:hidden"
          aria-label="Buka menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <OutletSwitcher />
      </div>

      {/* User Menu */}
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 hover:bg-gray-50 rounded-lg px-2 py-2 lg:px-3 transition-colors"
        >
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-left hidden sm:block">
            <p className="text-sm font-medium text-gray-900 max-w-[120px] truncate">{user.name}</p>
            <p className="text-xs text-gray-500">{roleLabel[user.role]}</p>
          </div>
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-20 py-1">
              <div className="px-4 py-2 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                <p className="text-xs text-gray-500 truncate">{user.email}</p>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Keluar
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
