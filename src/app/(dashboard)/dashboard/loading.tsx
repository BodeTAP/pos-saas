import { StatCardSkeleton, CardListSkeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-40 bg-gray-200 animate-pulse rounded-md" />
        <div className="h-4 w-56 bg-gray-200 animate-pulse rounded-md" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CardListSkeleton count={5} />
        <CardListSkeleton count={5} />
      </div>
    </div>
  );
}
