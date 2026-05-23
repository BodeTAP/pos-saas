import { PageHeaderSkeleton, Skeleton, TableSkeleton } from "@/components/ui/skeleton";

export default function InventoryLoading() {
  return (
    <div className="space-y-5">
      <PageHeaderSkeleton hasButton={false} />
      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-32 rounded-lg" />
        ))}
      </div>
      <TableSkeleton rows={8} cols={5} />
    </div>
  );
}
