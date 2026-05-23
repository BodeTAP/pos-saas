import Link from "next/link";
import { FileQuestion, Home } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";

/**
 * Halaman 404 global — tampil saat route tidak ditemukan.
 */
export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <FileQuestion className="w-8 h-8 text-blue-600" />
        </div>
        <h1 className="text-4xl font-bold text-gray-900 mb-2">404</h1>
        <h2 className="text-lg font-semibold text-gray-700 mb-2">Halaman Tidak Ditemukan</h2>
        <p className="text-gray-500 text-sm mb-8">
          Halaman yang kamu cari tidak ada atau sudah dipindahkan.
        </p>
        <div className="flex gap-3 justify-center">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            <Home className="w-4 h-4" />
            Dashboard
          </Link>
          <BackButton />
        </div>
      </div>
    </div>
  );
}
