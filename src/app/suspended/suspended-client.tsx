"use client";

import { useEffect } from "react";
import { signOut } from "next-auth/react";
import { AlertTriangle, CreditCard, Mail } from "lucide-react";
import Link from "next/link";

interface SuspendedClientProps {
  isSuspended: boolean;
  email: string;
  name: string;
}

export function SuspendedClient({ isSuspended, email, name }: SuspendedClientProps) {
  // Force signout otomatis saat halaman ini dimuat
  // Redirect ke login dengan reason param agar pesan yang tepat ditampilkan
  useEffect(() => {
    const reason = isSuspended ? "suspended" : "expired";
    signOut({ callbackUrl: `/login?reason=${reason}` });
  }, [isSuspended]);

  // Tampilkan loading sementara signout berjalan
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-8 text-center">
        <div
          className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
            isSuspended ? "bg-red-100" : "bg-orange-100"
          }`}
        >
          <AlertTriangle
            className={`w-8 h-8 ${isSuspended ? "text-red-600" : "text-orange-600"}`}
          />
        </div>

        <h1 className="text-xl font-bold text-gray-900 mb-2">
          {isSuspended ? "Akun Disuspend" : "Langganan Berakhir"}
        </h1>

        <p className="text-gray-500 text-sm mb-4">
          {isSuspended
            ? "Akun Anda telah disuspend. Anda akan diarahkan ke halaman login..."
            : "Masa aktif langganan Anda telah berakhir. Anda akan diarahkan ke halaman login..."}
        </p>

        <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
          <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
          Mengalihkan...
        </div>

        {/* Fallback jika redirect lambat */}
        <div className="mt-6 space-y-2">
          {!isSuspended && (
            <Link
              href="/dashboard/billing"
              className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
            >
              <CreditCard className="w-4 h-4" />
              Perbarui Langganan
            </Link>
          )}
          <a
            href="mailto:support@pos-saas.com"
            className="flex items-center justify-center gap-2 w-full border border-gray-200 text-gray-600 hover:bg-gray-50 py-2.5 rounded-xl text-sm transition-colors"
          >
            <Mail className="w-4 h-4" />
            Hubungi Support
          </a>
        </div>

        <p className="text-xs text-gray-400 mt-4">{name} · {email}</p>
      </div>
    </div>
  );
}
