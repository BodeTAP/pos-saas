"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, ShoppingCart, Loader2, AlertTriangle, Wrench } from "lucide-react";

const ERROR_MESSAGES: Record<string, { message: string; type: "error" | "warning" }> = {
  ACCOUNT_SUSPENDED: {
    message: "Akun Anda telah disuspend oleh administrator. Hubungi support untuk informasi lebih lanjut.",
    type: "warning",
  },
  SUBSCRIPTION_EXPIRED: {
    message: "Masa aktif langganan Anda telah berakhir. Silakan perbarui paket untuk melanjutkan.",
    type: "warning",
  },
  CredentialsSignin: {
    message: "Email atau password salah. Silakan coba lagi.",
    type: "error",
  },
  default: {
    message: "Email atau password salah. Silakan coba lagi.",
    type: "error",
  },
};

interface LoginClientProps {
  maintenanceMode: boolean;
  maintenanceMessage: string;
  platformName: string;
  callbackUrl: string;
  errorParam?: string;
  reason?: string;
}

function getRouteError(
  reason?: string,
  errorParam?: string
): { message: string; type: "error" | "warning" } | null {
  if (reason === "suspended") {
    return {
      message: "Akun Anda telah disuspend. Hubungi support untuk informasi lebih lanjut.",
      type: "warning",
    };
  }
  if (reason === "expired") {
    return {
      message: "Masa aktif langganan Anda telah berakhir. Silakan perbarui paket.",
      type: "warning",
    };
  }
  if (errorParam) return ERROR_MESSAGES[errorParam] || ERROR_MESSAGES.default;
  return null;
}

export function LoginClient({
  maintenanceMode,
  maintenanceMessage,
  platformName,
  callbackUrl,
  errorParam,
  reason,
}: LoginClientProps) {
  const router = useRouter();
  const routeError = getRouteError(reason, errorParam);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [errorType, setErrorType] = useState<"error" | "warning">("error");
  const displayError = error || routeError?.message || "";
  const displayErrorType = error ? errorType : routeError?.type || "error";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        const mapped = ERROR_MESSAGES[result.error] || ERROR_MESSAGES.default;
        setError(mapped.message);
        setErrorType(mapped.type);
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setError("Terjadi kesalahan. Silakan coba lagi.");
      setErrorType("error");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
            <ShoppingCart className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{platformName}</h1>
          <p className="text-gray-500 mt-1">Sistem Kasir Modern untuk UMKM</p>
        </div>

        {/* Maintenance Mode Banner */}
        {maintenanceMode && (
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5 mb-4 text-center">
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Wrench className="w-6 h-6 text-orange-600" />
            </div>
            <h2 className="font-semibold text-orange-900 mb-1">Mode Maintenance</h2>
            <p className="text-sm text-orange-700">{maintenanceMessage}</p>
            <p className="text-xs text-orange-500 mt-2">Super Admin masih bisa login di bawah.</p>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">Masuk ke Akun</h2>

          {displayError && (
            <div
              className={`flex items-start gap-3 px-4 py-3 rounded-lg mb-4 text-sm ${
                displayErrorType === "warning"
                  ? "bg-orange-50 border border-orange-200 text-orange-800"
                  : "bg-red-50 border border-red-200 text-red-700"
              }`}
            >
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{displayError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@toko.com"
                required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Memproses...</>
              ) : (
                "Masuk"
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-500">
            Belum punya akun?{" "}
            <Link href="/register" className="text-blue-600 hover:underline font-medium">
              Daftar sekarang
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
