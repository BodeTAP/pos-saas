"use client";

import { useState } from "react";
import { MailCheck, X, Loader2, CheckCircle } from "lucide-react";

interface EmailVerificationBannerProps {
  userEmail: string;
}

/**
 * Banner yang muncul di dashboard jika email belum diverifikasi.
 * User bisa kirim ulang email verifikasi langsung dari banner.
 */
export function EmailVerificationBanner({ userEmail }: EmailVerificationBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  if (dismissed) return null;

  async function handleResend() {
    setIsSending(true);
    setError("");
    try {
      const res = await fetch("/api/auth/verify-email", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal mengirim email.");
        return;
      }
      setSent(true);
    } catch {
      setError("Terjadi kesalahan. Coba lagi.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3 mb-4">
      <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
        <MailCheck className="w-4 h-4 text-amber-600" />
      </div>
      <div className="flex-1 min-w-0">
        {sent ? (
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            <p className="text-sm font-medium">
              Email verifikasi dikirim ke <strong>{userEmail}</strong>. Periksa inbox kamu.
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm font-medium text-amber-800">
              Verifikasi email kamu
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              Kami mengirim link verifikasi ke <strong>{userEmail}</strong>.
              Periksa inbox dan folder spam.
            </p>
            {error && (
              <p className="text-xs text-red-600 mt-1">{error}</p>
            )}
            <button
              onClick={handleResend}
              disabled={isSending}
              className="mt-2 text-xs font-medium text-amber-800 underline hover:text-amber-900 disabled:opacity-50 flex items-center gap-1"
            >
              {isSending ? (
                <><Loader2 className="w-3 h-3 animate-spin" /> Mengirim...</>
              ) : (
                "Kirim ulang email verifikasi"
              )}
            </button>
          </>
        )}
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-amber-400 hover:text-amber-600 flex-shrink-0 p-0.5"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
