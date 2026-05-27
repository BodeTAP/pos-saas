import { PageHeaderSkeleton, Skeleton, SkeletonPulse } from "@/components/ui/skeleton";

export default function TablesLoading() {
  return (
    <div className="space-y-5">
      <PageHeaderSkeleton />
      <SkeletonPulse className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
            <Skeleton className="h-8 w-8 mb-1" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </SkeletonPulse>
      <SkeletonPulse className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
            <Skeleton className="h-6 w-12" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        ))}
      </SkeletonPulse>
    </div>
  );
}
