"use client";

import { useState } from "react";
import { MailCheck, X, Loader2, CheckCircle } from "lucide-react";

interface EmailVerificationBannerProps {
  userEmail: string;
}

/**
 * Banner compact di atas halaman untuk OWNER yang belum verifikasi email.
 * Kasir tidak perlu verifikasi — mereka dibuat oleh Owner, bukan self-register.
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
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2 text-xs">
      <MailCheck className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />

      {sent ? (
        <span className="flex items-center gap-1.5 text-green-700 flex-1">
          <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
          Email verifikasi dikirim ke <strong>{userEmail}</strong>. Periksa inbox kamu.
        </span>
      ) : (
        <span className="flex items-center gap-1.5 flex-1 flex-wrap text-amber-800">
          <span>Verifikasi email kamu —</span>
          <span className="text-amber-700">
            link dikirim ke <strong>{userEmail}</strong>
          </span>
          {error && <span className="text-red-600">· {error}</span>}
          <button
            onClick={handleResend}
            disabled={isSending}
            className="underline font-medium hover:text-amber-900 disabled:opacity-50 inline-flex items-center gap-1"
          >
            {isSending ? (
              <><Loader2 className="w-3 h-3 animate-spin" /> Mengirim...</>
            ) : (
              "Kirim ulang"
            )}
          </button>
        </span>
      )}

      <button
        onClick={() => setDismissed(true)}
        className="text-amber-400 hover:text-amber-600 flex-shrink-0 ml-auto"
        aria-label="Tutup"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
