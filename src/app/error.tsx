"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Global error boundary — menangkap crash di semua route.
 * Next.js App Router otomatis wrap ini sebagai React Error Boundary.
 */
export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log ke console untuk debugging
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <html lang="id">
      <body className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Terjadi Kesalahan</h1>
          <p className="text-gray-500 text-sm mb-6">
            Aplikasi mengalami error yang tidak terduga. Silakan coba lagi atau kembali ke halaman utama.
          </p>
          {process.env.NODE_ENV === "development" && error.message && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-6 text-left">
              <p className="text-xs font-mono text-red-700 break-all">{error.message}</p>
              {error.digest && (
                <p className="text-xs text-red-400 mt-1">Digest: {error.digest}</p>
              )}
            </div>
          )}
          <div className="flex gap-3 justify-center">
            <button
              onClick={reset}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Coba Lagi
            </button>
            <a
              href="/"
              className="flex items-center gap-2 border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              <Home className="w-4 h-4" />
              Halaman Utama
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
