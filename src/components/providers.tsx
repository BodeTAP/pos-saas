"use client";

import { SessionProvider } from "next-auth/react";
import { Toaster } from "@/components/ui/toaster";
import { SubscriptionStatusWatcher } from "@/components/subscription-status-watcher";
import { SWRegister } from "@/components/pwa/sw-register";
import { PWAInstallPrompt } from "@/components/pwa/pwa-install-prompt";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SWRegister />
      <SubscriptionStatusWatcher />
      {children}
      <Toaster />
      <PWAInstallPrompt />
    </SessionProvider>
  );
}
