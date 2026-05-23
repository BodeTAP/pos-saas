"use client";

import { useEffect } from "react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Global error boundary — menangkap crash di root layout.
 * Harus bernama global-error.tsx dan render <html>/<body> sendiri
 * karena me-replace seluruh root layout saat error.
 *
 * PENTING: Tailwind tidak tersedia di sini karena globals.css di-load
 * di layout.tsx yang di-bypass. Gunakan inline styles.
 */
export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  const isDev = process.env.NODE_ENV === "development";

  return (
    <html lang="id">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Terjadi Kesalahan — POS SaaS</title>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f9fafb;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1rem;
          }
          .container { max-width: 28rem; width: 100%; text-align: center; }
          .icon-wrap {
            width: 4rem; height: 4rem; background: #fee2e2; border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            margin: 0 auto 1rem;
          }
          h1 { font-size: 1.25rem; font-weight: 700; color: #111827; margin-bottom: 0.5rem; }
          p { color: #6b7280; font-size: 0.875rem; margin-bottom: 1.5rem; line-height: 1.5; }
          .error-box {
            background: #fef2f2; border: 1px solid #fecaca; border-radius: 0.5rem;
            padding: 0.75rem; margin-bottom: 1.5rem; text-align: left;
          }
          .error-msg { font-family: monospace; font-size: 0.75rem; color: #b91c1c; word-break: break-all; }
          .error-digest { font-size: 0.75rem; color: #f87171; margin-top: 0.25rem; }
          .actions { display: flex; gap: 0.75rem; justify-content: center; }
          .btn-primary {
            display: inline-flex; align-items: center; gap: 0.5rem;
            background: #2563eb; color: #fff; border: none; cursor: pointer;
            padding: 0.625rem 1rem; border-radius: 0.5rem;
            font-size: 0.875rem; font-weight: 500; text-decoration: none;
          }
          .btn-primary:hover { background: #1d4ed8; }
          .btn-secondary {
            display: inline-flex; align-items: center; gap: 0.5rem;
            background: #fff; color: #374151; border: 1px solid #d1d5db;
            padding: 0.625rem 1rem; border-radius: 0.5rem;
            font-size: 0.875rem; font-weight: 500; text-decoration: none;
          }
          .btn-secondary:hover { background: #f9fafb; }
        `}</style>
      </head>
      <body>
        <div className="container">
          <div className="icon-wrap">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <h1>Terjadi Kesalahan</h1>
          <p>
            Aplikasi mengalami error yang tidak terduga. Silakan coba lagi atau kembali ke halaman utama.
          </p>
          {isDev && error.message && (
            <div className="error-box">
              <p className="error-msg">{error.message}</p>
              {error.digest && <p className="error-digest">Digest: {error.digest}</p>}
            </div>
          )}
          <div className="actions">
            <button onClick={reset} className="btn-primary">
              ↺ Coba Lagi
            </button>
            <a href="/" className="btn-secondary">
              ⌂ Halaman Utama
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
