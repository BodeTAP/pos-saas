"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

const POLL_INTERVAL = 5 * 60 * 1000; // 5 menit

/**
 * Background poller untuk cek perubahan status langganan tenant.
 * Kalau status berubah (suspended/expired), trigger session update
 * agar middleware bisa redirect ke halaman suspended.
 */
export function SubscriptionStatusWatcher() {
  const { data: session, update } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!session?.user.tenantId || session.user.role === "SUPER_ADMIN") return;

    async function checkStatus() {
      try {
        const res = await fetch("/api/auth/refresh-status", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();

        if (data.changed && data.subscriptionStatus) {
          // Update token JWT lewat session.update()
          await update({ subscriptionStatus: data.subscriptionStatus });
          // Refresh router agar middleware re-evaluate
          router.refresh();
        }
      } catch {
        // Diam saja, retry di interval berikutnya
      }
    }

    // Cek pertama saat mount
    checkStatus();

    const interval = setInterval(checkStatus, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [session?.user.tenantId, session?.user.role, update, router]);

  return null;
}
