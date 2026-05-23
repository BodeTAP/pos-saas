import { PageHeaderSkeleton, FilterBarSkeleton, StatCardSkeleton, TableSkeleton } from "@/components/ui/skeleton";

export default function PurchaseOrdersLoading() {
  return (
    <div className="space-y-5">
      <PageHeaderSkeleton />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
      </div>
      <FilterBarSkeleton inputs={2} />
      <TableSkeleton rows={6} cols={6} />
    </div>
  );
}
