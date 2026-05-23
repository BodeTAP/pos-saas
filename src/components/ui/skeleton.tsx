/**
 * Komponen skeleton reusable untuk loading state.
 * Dipakai di semua loading.tsx halaman dashboard.
 *
 * PENTING: animate-pulse dipasang di container level, bukan per-element,
 * agar browser hanya menjalankan SATU animasi CSS per blok skeleton.
 * Ini mencegah jank dari puluhan animasi paralel.
 */

import { cn } from "@/lib/utils";

// ─── Primitive ───────────────────────────────

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-md bg-gray-200", className)} />
  );
}

// ─── Pulse Wrapper — satu animasi untuk semua children ───

export function SkeletonPulse({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("animate-pulse", className)}>
      {children}
    </div>
  );
}

// ─── Stat Card ───────────────────────────────

export function StatCardSkeleton() {
  return (
    <SkeletonPulse className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <Skeleton className="w-10 h-10 rounded-lg" />
      </div>
      <Skeleton className="h-8 w-24 mb-2" />
      <Skeleton className="h-4 w-32" />
    </SkeletonPulse>
  );
}

// ─── Table Row ───────────────────────────────

export function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}

// ─── Table Skeleton ──────────────────────────

export function TableSkeleton({
  rows = 5,
  cols = 5,
  title,
  hasAction = true,
}: {
  rows?: number;
  cols?: number;
  title?: string;
  hasAction?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        {title ? (
          <span className="font-semibold text-gray-900">{title}</span>
        ) : (
          <Skeleton className="h-5 w-32 animate-pulse" />
        )}
        {hasAction && <Skeleton className="h-8 w-24 rounded-lg animate-pulse" />}
      </div>
      {/* Satu animate-pulse untuk seluruh tabel */}
      <SkeletonPulse className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {Array.from({ length: cols }).map((_, i) => (
                <th key={i} className="px-4 py-3">
                  <Skeleton className="h-4 w-full" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {Array.from({ length: rows }).map((_, i) => (
              <TableRowSkeleton key={i} cols={cols} />
            ))}
          </tbody>
        </table>
      </SkeletonPulse>
    </div>
  );
}

// ─── Card List Skeleton ───────────────────────

export function CardListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <Skeleton className="h-5 w-40 animate-pulse" />
      </div>
      <SkeletonPulse className="divide-y divide-gray-100">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex items-center justify-between px-5 py-3">
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-5 w-20" />
          </div>
        ))}
      </SkeletonPulse>
    </div>
  );
}

// ─── Page Header Skeleton ─────────────────────

export function PageHeaderSkeleton({ hasButton = true }: { hasButton?: boolean }) {
  return (
    <SkeletonPulse className="flex items-center justify-between">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      {hasButton && <Skeleton className="h-9 w-28 rounded-xl" />}
    </SkeletonPulse>
  );
}

// ─── Filter Bar Skeleton ──────────────────────

export function FilterBarSkeleton({ inputs = 3 }: { inputs?: number }) {
  return (
    <SkeletonPulse className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex flex-wrap gap-3">
        {Array.from({ length: inputs }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-40 rounded-lg" />
        ))}
        <Skeleton className="h-9 w-24 rounded-lg" />
      </div>
    </SkeletonPulse>
  );
}
