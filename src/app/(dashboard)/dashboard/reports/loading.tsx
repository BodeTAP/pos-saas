import { StatCardSkeleton, FilterBarSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function ReportsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-20 rounded-xl" />
          <Skeleton className="h-9 w-16 rounded-xl" />
        </div>
      </div>
      <FilterBarSkeleton inputs={5} />
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
            <Skeleton className="h-8 w-8 rounded-lg mb-2" />
            <Skeleton className="h-6 w-20 mb-1" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
      {/* Chart placeholder */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <Skeleton className="h-5 w-48 mb-4" />
        <Skeleton className="h-72 w-full rounded-lg" />
      </div>
    </div>
  );
}
