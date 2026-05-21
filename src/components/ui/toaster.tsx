"use client";

import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      richColors
      closeButton
      duration={4000}
      toastOptions={{
        style: { fontFamily: "inherit" },
      }}
    />
  );
}

// Re-export toast untuk dipakai di seluruh app
export { toast } from "sonner";
