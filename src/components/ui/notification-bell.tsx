"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bell, Package, ShoppingBag, Info, CheckCheck, X } from "lucide-react";
import { useNotifications, AppNotification } from "@/hooks/use-notifications";

const TYPE_CONFIG = {
  LOW_STOCK: {
    icon: Package,
    iconColor: "text-orange-500",
    bgColor: "bg-orange-50",
    dotColor: "bg-orange-500",
  },
  NEW_TRANSACTION: {
    icon: ShoppingBag,
    iconColor: "text-green-500",
    bgColor: "bg-green-50",
    dotColor: "bg-green-500",
  },
  SYSTEM: {
    icon: Info,
    iconColor: "text-blue-500",
    bgColor: "bg-blue-50",
    dotColor: "bg-blue-500",
  },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Baru saja";
  if (mins < 60) return `${mins} menit lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  return `${days} hari lalu`;
}

function NotificationItem({
  notification,
  onRead,
  onNavigate,
}: {
  notification: AppNotification;
  onRead: (id: string) => void;
  onNavigate: (link: string) => void;
}) {
  const config = TYPE_CONFIG[notification.type] || TYPE_CONFIG.SYSTEM;
  const Icon = config.icon;

  function handleClick() {
    if (!notification.isRead) onRead(notification.id);
    if (notification.link) onNavigate(notification.link);
  }

  return (
    <div
      onClick={handleClick}
      className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer ${
        !notification.isRead ? "bg-blue-50/40" : ""
      }`}
    >
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${config.bgColor}`}>
        <Icon className={`w-4 h-4 ${config.iconColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm leading-tight text-gray-900 ${!notification.isRead ? "font-semibold" : "font-medium"}`}>
            {notification.title}
          </p>
          {!notification.isRead && (
            <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${config.dotColor}`} />
          )}
        </div>
        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notification.message}</p>
        <p className="text-xs text-gray-400 mt-1">{timeAgo(notification.createdAt)}</p>
      </div>
    </div>
  );
}

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead } = useNotifications();

  // Tutup dropdown saat klik di luar
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
        aria-label="Notifikasi"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-1rem)] bg-white rounded-xl shadow-lg border border-gray-200 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-gray-600" />
              <span className="text-sm font-semibold text-gray-900">Notifikasi</span>
              {unreadCount > 0 && (
                <span className="bg-red-100 text-red-600 text-xs font-medium px-1.5 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                  title="Tandai semua dibaca"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Baca semua
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded hover:bg-gray-100 text-gray-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {isLoading && notifications.length === 0 ? (
              <div className="py-8 text-center">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-10 text-center">
                <Bell className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Tidak ada notifikasi</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {notifications.map((n) => (
                  <NotificationItem
                    key={n.id}
                    notification={n}
                    onRead={markAsRead}
                    onNavigate={(link) => {
                      setOpen(false);
                      router.push(link);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
