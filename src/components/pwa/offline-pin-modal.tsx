"use client";

import { useState, useRef, useEffect } from "react";
import { WifiOff, Lock, AlertCircle, Loader2 } from "lucide-react";
import { verifyOfflinePin, createOfflineSession } from "@/lib/offline-pin";
import { cn } from "@/lib/utils";

interface OfflinePinModalProps {
  userId: string;
  cashierId: string;
  outletId: string;
  onSuccess: () => void;
}

/**
 * Modal PIN offline — muncul saat session expired dan tidak ada koneksi.
 * Kasir input PIN 6 digit untuk membuka sesi offline terbatas (8 jam).
 */
export function OfflinePinModal({
  userId,
  cashierId,
  outletId,
  onSuccess,
}: OfflinePinModalProps) {
  const [pin, setPin] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Focus digit pertama saat modal muncul
    inputRefs.current[0]?.focus();
  }, []);

  function handleDigitChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return; // hanya angka

    const newPin = [...pin];
    newPin[index] = value.slice(-1); // ambil 1 digit terakhir
    setPin(newPin);
    setError(null);

    // Auto-focus ke digit berikutnya
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit jika semua digit terisi
    if (newPin.every((d) => d !== "") && newPin[index] !== "") {
      handleVerify(newPin.join(""));
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  async function handleVerify(pinStr?: string) {
    const fullPin = pinStr || pin.join("");
    if (fullPin.length !== 6) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await verifyOfflinePin(userId, fullPin);

      if (result.valid) {
        await createOfflineSession(userId, cashierId, outletId);
        onSuccess();
      } else {
        setError(result.reason || "PIN salah.");
        // Reset PIN
        setPin(["", "", "", "", "", ""]);
        setTimeout(() => inputRefs.current[0]?.focus(), 100);
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <WifiOff className="w-8 h-8 text-orange-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Mode Offline</h2>
          <p className="text-sm text-gray-500 mt-1">
            Masukkan PIN 6 digit untuk melanjutkan
          </p>
        </div>

        {/* Info banner */}
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 mb-5 flex items-start gap-2">
          <Lock className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-orange-700">
            Sesi offline berlaku 8 jam. Hanya halaman kasir yang bisa diakses.
            Transaksi akan disinkronkan saat internet kembali.
          </p>
        </div>

        {/* PIN Input */}
        <div className="flex gap-2 justify-center mb-4">
          {pin.map((digit, index) => (
            <input
              key={index}
              ref={(el) => { inputRefs.current[index] = el; }}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleDigitChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              className={cn(
                "w-11 h-14 text-center text-xl font-bold border-2 rounded-xl focus:outline-none transition-colors",
                error
                  ? "border-red-400 bg-red-50 text-red-700"
                  : digit
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-300 text-gray-900 focus:border-blue-500"
              )}
              disabled={isLoading}
            />
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 text-red-600 text-sm mb-4 justify-center">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Submit button */}
        <button
          onClick={() => handleVerify()}
          disabled={pin.some((d) => !d) || isLoading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Memverifikasi...</>
          ) : (
            "Masuk Mode Offline"
          )}
        </button>

        <p className="text-xs text-gray-400 text-center mt-3">
          PIN diset oleh Owner di halaman Pengaturan
        </p>
      </div>
    </div>
  );
}
