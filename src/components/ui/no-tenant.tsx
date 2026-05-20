import { Store } from "lucide-react";

export function NoTenant() {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
        <Store className="w-8 h-8 text-gray-400" />
      </div>
      <h2 className="text-lg font-semibold text-gray-700 mb-1">
        Tidak Ada Toko Terpilih
      </h2>
      <p className="text-sm text-gray-400 max-w-xs">
        Akun Super Admin tidak terhubung ke toko. Halaman ini hanya tersedia untuk Owner dan Kasir.
      </p>
    </div>
  );
}
