"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { UserRole } from "@prisma/client";
import { EmailVerificationBanner } from "@/components/ui/email-verification-banner";

interface DashboardShellProps {
  user: { name: string; email: string; role: UserRole };
  children: React.ReactNode;
  emailVerified?: boolean;
  userEmail?: string;
}

export function DashboardShell({ user, children, emailVerified = true, userEmail }: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar
        role={user.role}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header user={user} onMenuClick={() => setSidebarOpen(true)} />
        {/* Banner verifikasi email — compact strip, di luar main agar tidak ganggu konten */}
        {!emailVerified && user.role === "OWNER" && userEmail && (
          <EmailVerificationBanner userEmail={userEmail} />
        )}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
