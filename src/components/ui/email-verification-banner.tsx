"use client";

import { useState } from "react";
import { MailCheck, X, Loader2, CheckCircle } from "lucide-react";

interface EmailVerificationBannerProps {
  userEmail: string;
}

export function EmailVerificationBanner({ userEmail }: EmailVerificationBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);

  if (dismissed) return null;

  async function handleResend() {
    setIsSending(true);
    try {
      const res = await fetch("/api/auth/verify-email", { method: "POST" });
      if (res.ok) setSent(true);
    } catch { /* ignore */ }
    finally { setIsSending(false); }
  }

  return (
    <div className="bg-amber-50 border-b border-amber-200 h-8 px-4 flex items-center gap-2 text-xs text-amber-800 flex-shrink-0">
      <MailCheck className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />

      {sent ? (
        <span className="flex items-center gap-1 text-green-700 truncate">
          <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
          Email verifikasi dikirim ke {userEmail}
        </span>
      ) : (
        <>
          <span className="truncate min-w-0">
            Verifikasi email kamu · cek inbox <strong className="font-semibold">{userEmail}</strong>
          </span>
          <button
            onClick={handleResend}
            disabled={isSending}
            className="underline font-medium hover:text-amber-900 disabled:opacity-50 flex-shrink-0 flex items-center gap-1"
          >
            {isSending
              ? <><Loader2 className="w-3 h-3 animate-spin" />Mengirim</>
              : "Kirim ulang"
            }
          </button>
        </>
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
