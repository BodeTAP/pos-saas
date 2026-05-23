"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

/**
 * Tombol kembali yang menggunakan router.back().
 * Jika tidak ada history (user langsung akses URL), fallback ke /dashboard.
 */
export function BackButton({ fallback = "/dashboard" }: { fallback?: string }) {
  const router = useRouter();

  function handleBack() {
    // Cek apakah ada history yang bisa di-back
    // window.history.length <= 1 berarti tidak ada halaman sebelumnya
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallback);
    }
  }

  return (
    <button
      onClick={handleBack}
      className="flex items-center gap-2 border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
    >
      <ArrowLeft className="w-4 h-4" />
      Kembali
    </button>
  );
}
