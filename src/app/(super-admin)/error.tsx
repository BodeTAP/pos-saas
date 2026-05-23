"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Shield } from "lucide-react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function SuperAdminError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error("[SuperAdminError]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
      <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mb-4">
        <AlertTriangle className="w-7 h-7 text-red-600" />
      </div>
      <h2 className="text-lg font-bold text-gray-900 mb-2">Halaman Tidak Dapat Dimuat</h2>
      <p className="text-gray-500 text-sm mb-1 max-w-sm">
        Terjadi kesalahan di panel admin. Silakan coba lagi.
      </p>
      {process.env.NODE_ENV === "development" && error.message && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 my-4 text-left max-w-sm w-full">
          <p className="text-xs font-mono text-red-700 break-all">{error.message}</p>
          {error.digest && (
            <p className="text-xs text-red-400 mt-1">Digest: {error.digest}</p>
          )}
        </div>
      )}
      <div className="flex gap-3 mt-4">
        <button
          onClick={reset}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Coba Lagi
        </button>
        <a
          href="/super-admin"
          className="flex items-center gap-2 border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Shield className="w-4 h-4" />
          Panel Admin
        </a>
      </div>
    </div>
  );
}
