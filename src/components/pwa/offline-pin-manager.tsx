"use client";

import { useState } from "react";
import { Lock, Check, AlertCircle, Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

interface StaffMember {
  id: string;
  name: string;
  role: string;
}

interface OfflinePinManagerProps {
  staff: StaffMember[];
}

/**
 * Komponen untuk Owner mengatur PIN offline kasir.
 * Ditampilkan di halaman Settings.
 */
export function OfflinePinManager({ staff }: OfflinePinManagerProps) {
  const [selectedUserId, setSelectedUserId] = useState(staff[0]?.id || "");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const kasirList = staff.filter((s) => s.role === "KASIR");

  async function handleSetPin() {
    if (pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      toast.error("PIN harus 6 digit angka.");
      return;
    }
    if (pin !== confirmPin) {
      toast.error("Konfirmasi PIN tidak cocok.");
      return;
    }
    if (!selectedUserId) {
      toast.error("Pilih kasir terlebih dahulu.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/offline/set-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUserId, pin }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Gagal mengatur PIN.");
        return;
      }

      const kasir = kasirList.find((k) => k.id === selectedUserId);
      toast.success(
        `PIN offline untuk ${kasir?.name || "kasir"} berhasil diatur. Kasir perlu login di device-nya untuk sync PIN ke perangkatnya.`
      );
      setPin("");
      setConfirmPin("");
    } finally {
      setIsLoading(false);
    }
  }

  if (kasirList.length === 0) {
    return (
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 text-sm text-gray-500">
        Belum ada kasir. Tambahkan kasir di halaman Karyawan terlebih dahulu.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2">
        <Lock className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700">
          PIN offline digunakan kasir untuk mengakses halaman kasir saat internet tidak tersedia.
          PIN berlaku 30 hari dan hanya bisa digunakan di perangkat ini.
        </p>
      </div>

      <div className="space-y-3">
        {/* Pilih kasir */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Kasir
          </label>
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {kasirList.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </select>
        </div>

        {/* Input PIN */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            PIN Baru (6 digit)
          </label>
          <div className="relative">
            <input
              type={showPin ? "text" : "password"}
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="••••••"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10 tracking-widest"
            />
            <button
              type="button"
              onClick={() => setShowPin(!showPin)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Konfirmasi PIN */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Konfirmasi PIN
          </label>
          <div className="relative">
            <input
              type={showPin ? "text" : "password"}
              inputMode="numeric"
              maxLength={6}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="••••••"
              className={`w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 tracking-widest ${
                confirmPin && pin !== confirmPin
                  ? "border-red-400 focus:ring-red-500"
                  : "border-gray-300"
              }`}
            />
            {confirmPin && pin === confirmPin && pin.length === 6 && (
              <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
            )}
            {confirmPin && pin !== confirmPin && (
              <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" />
            )}
          </div>
          {confirmPin && pin !== confirmPin && (
            <p className="text-xs text-red-500 mt-1">PIN tidak cocok</p>
          )}
        </div>

        <button
          onClick={handleSetPin}
          disabled={isLoading || pin.length !== 6 || pin !== confirmPin}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-xl text-sm transition-colors"
        >
          {isLoading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...</>
          ) : (
            <><Lock className="w-4 h-4" /> Simpan PIN Offline</>
          )}
        </button>
      </div>
    </div>
  );
}
