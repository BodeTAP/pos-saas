"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ShoppingCart, Loader2, Eye, EyeOff, AlertCircle } from "lucide-react";

interface RegisterClientProps {
  registrationEnabled: boolean;
  platformName: string;
}

export function RegisterClient({ registrationEnabled, platformName }: RegisterClientProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState({
    ownerName: "",
    email: "",
    password: "",
    storeName: "",
    phone: "",
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Registrasi gagal. Silakan coba lagi.");
        return;
      }

      router.push("/login?registered=true");
    } catch {
      setError("Terjadi kesalahan. Silakan coba lagi.");
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
          <p className="text-gray-500 mt-1">Daftar dan mulai kelola toko Anda</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          {!registrationEnabled ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-7 h-7 text-orange-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                Pendaftaran Tidak Tersedia
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                Pendaftaran tenant baru sedang tidak tersedia saat ini. Silakan hubungi administrator untuk informasi lebih lanjut.
              </p>
              <Link
                href="/login"
                className="text-blue-600 hover:underline text-sm font-medium"
              >
                Kembali ke halaman login
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-gray-800 mb-6">Buat Akun Baru</h2>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nama Toko <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="storeName"
                    value={form.storeName}
                    onChange={handleChange}
                    placeholder="Toko Maju Jaya"
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nama Pemilik <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="ownerName"
                    value={form.ownerName}
                    onChange={handleChange}
                    placeholder="Budi Santoso"
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="budi@tokojaya.com"
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    No. Telepon
                  </label>
                  <input
                    name="phone"
                    type="tel"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="08123456789"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      name="password"
                      type={showPassword ? "text" : "password"}
                      value={form.password}
                      onChange={handleChange}
                      placeholder="Minimal 8 karakter"
                      required
                      minLength={8}
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
                    <><Loader2 className="w-4 h-4 animate-spin" /> Mendaftarkan...</>
                  ) : (
                    "Daftar Gratis"
                  )}
                </button>
              </form>

              <p className="mt-4 text-xs text-gray-400 text-center">
                Dengan mendaftar, Anda mendapatkan akses trial gratis.
              </p>

              <div className="mt-4 text-center text-sm text-gray-500">
                Sudah punya akun?{" "}
                <Link href="/login" className="text-blue-600 hover:underline font-medium">
                  Masuk di sini
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
