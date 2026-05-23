"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface AppNotification {
  id: string;
  type: "LOW_STOCK" | "NEW_TRANSACTION" | "SYSTEM";
  title: string;
  message: string;
  isRead: boolean;
  link: string | null;
  createdAt: string;
}

interface UseNotificationsReturn {
  notifications: AppNotification[];
  unreadCount: number;
  isLoading: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refresh: () => Promise<void>;
}

const POLL_INTERVAL_MS = 30_000; // 30 detik

export function useNotifications(): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?unreadOnly=false&limit=20", {
        // Tidak cache agar selalu fresh
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json() as { notifications: AppNotification[]; unreadCount: number };
      if (mountedRef.current) {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      }
    } catch {
      // Gagal fetch — abaikan, coba lagi di interval berikutnya
    }
  }, []);

  // Initial fetch + polling
  useEffect(() => {
    // Reset mounted flag setiap kali effect berjalan (termasuk re-mount)
    mountedRef.current = true;
    setIsLoading(true);
    fetchNotifications().finally(() => {
      if (mountedRef.current) setIsLoading(false);
    });

    // Polling — hanya saat tab aktif (Page Visibility API)
    function startPolling() {
      if (intervalRef.current) return;
      intervalRef.current = setInterval(() => {
        // Skip jika tab tidak visible
        if (document.visibilityState === "visible") {
          fetchNotifications();
        }
      }, POLL_INTERVAL_MS);
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        // Tab kembali aktif — fetch langsung + restart polling
        fetchNotifications();
        startPolling();
      } else {
        // Tab tidak aktif — hentikan polling untuk hemat resource
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    }

    startPolling();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchNotifications]);

  const markAsRead = useCallback(async (id: string) => {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      await fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
    } catch {
      // Rollback jika gagal
      fetchNotifications();
    }
  }, [fetchNotifications]);

  const markAllAsRead = useCallback(async () => {
    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);

    try {
      await fetch("/api/notifications/read-all", { method: "POST" });
    } catch {
      fetchNotifications();
    }
  }, [fetchNotifications]);

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    refresh: fetchNotifications,
  };
}
