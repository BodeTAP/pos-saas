"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ShoppingCart, CheckCircle, AlertTriangle, XCircle, Loader2 } from "lucide-react";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const status = searchParams.get("status");

  const config = {
    success: {
      icon: CheckCircle,
      iconBg: "bg-green-100",
      iconColor: "text-green-600",
      title: "Email Berhasil Diverifikasi!",
      message: "Alamat email kamu telah dikonfirmasi. Sekarang kamu bisa menggunakan semua fitur tanpa batasan.",
      action: { href: "/dashboard", label: "Buka Dashboard" },
      actionClass: "bg-blue-600 hover:bg-blue-700 text-white",
    },
    expired: {
      icon: AlertTriangle,
      iconBg: "bg-orange-100",
      iconColor: "text-orange-600",
      title: "Link Sudah Kedaluwarsa",
      message: "Link verifikasi ini sudah tidak berlaku (expired setelah 24 jam). Login ke dashboard dan minta link verifikasi baru.",
      action: { href: "/login", label: "Login & Minta Link Baru" },
      actionClass: "bg-blue-600 hover:bg-blue-700 text-white",
    },
    invalid: {
      icon: XCircle,
      iconBg: "bg-red-100",
      iconColor: "text-red-600",
      title: "Link Tidak Valid",
      message: "Link verifikasi ini tidak valid atau sudah pernah digunakan. Login ke dashboard untuk meminta link baru.",
      action: { href: "/login", label: "Kembali ke Login" },
      actionClass: "bg-blue-600 hover:bg-blue-700 text-white",
    },
    error: {
      icon: XCircle,
      iconBg: "bg-red-100",
      iconColor: "text-red-600",
      title: "Terjadi Kesalahan",
      message: "Gagal memverifikasi email. Silakan coba lagi atau hubungi support.",
      action: { href: "/login", label: "Kembali ke Login" },
      actionClass: "bg-blue-600 hover:bg-blue-700 text-white",
    },
    // Fallback jika tidak ada status param (akses langsung ke /verify-email)
    default: {
      icon: CheckCircle,
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      title: "Verifikasi Email",
      message: "Klik link verifikasi yang dikirim ke email kamu untuk mengaktifkan akun.",
      action: { href: "/dashboard", label: "Buka Dashboard" },
      actionClass: "bg-blue-600 hover:bg-blue-700 text-white",
    },
  };

  const current = (status && config[status as keyof typeof config]) || config.default;
  const Icon = current.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
            <ShoppingCart className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">POS SaaS</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className={`w-16 h-16 ${current.iconBg} rounded-full flex items-center justify-center mx-auto mb-4`}>
            <Icon className={`w-8 h-8 ${current.iconColor}`} />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">{current.title}</h2>
          <p className="text-gray-500 text-sm mb-6 leading-relaxed">{current.message}</p>
          <Link
            href={current.action.href}
            className={`inline-flex items-center justify-center w-full font-medium py-2.5 rounded-lg transition-colors text-sm ${current.actionClass}`}
          >
            {current.action.label}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
