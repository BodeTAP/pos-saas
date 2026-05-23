import { Skeleton, SkeletonPulse } from "@/components/ui/skeleton";

export default function POSLoading() {
  return (
    <div className="flex h-[calc(100vh-4rem)] gap-0 -m-4 lg:-m-6 overflow-hidden">
      {/* Product grid area */}
      <div className="flex-1 flex flex-col min-w-0 p-4 overflow-hidden">
        {/* Search + filter bar */}
        <SkeletonPulse className="flex gap-2 mb-4">
          <Skeleton className="h-10 flex-1 rounded-xl" />
          <Skeleton className="h-10 w-24 rounded-xl" />
        </SkeletonPulse>
        {/* Category tabs */}
        <SkeletonPulse className="flex gap-2 mb-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20 flex-shrink-0 rounded-full" />
          ))}
        </SkeletonPulse>
        {/* Product grid — satu pulse untuk semua cards */}
        <SkeletonPulse className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
              <Skeleton className="h-20 w-full rounded-lg" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </SkeletonPulse>
      </div>

      {/* Cart sidebar — satu pulse untuk seluruh sidebar */}
      <SkeletonPulse className="w-80 flex-shrink-0 bg-white border-l border-gray-200 p-4 flex-col gap-3 hidden lg:flex">
        <Skeleton className="h-6 w-24" />
        <div className="flex-1 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-6 w-16" />
            </div>
          ))}
        </div>
        <div className="space-y-2 border-t border-gray-100 pt-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      </SkeletonPulse>
    </div>
  );
}
