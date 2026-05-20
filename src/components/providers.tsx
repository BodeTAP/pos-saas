"use client";

import { SessionProvider } from "next-auth/react";
import { Toaster } from "@/components/ui/toaster";
import { SubscriptionStatusWatcher } from "@/components/subscription-status-watcher";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SubscriptionStatusWatcher />
      {children}
      <Toaster />
    </SessionProvider>
  );
}
