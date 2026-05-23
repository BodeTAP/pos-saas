import { PageHeaderSkeleton, TableSkeleton } from "@/components/ui/skeleton";

export default function OutletsLoading() {
  return (
    <div className="space-y-5">
      <PageHeaderSkeleton />
      <TableSkeleton rows={4} cols={5} />
    </div>
  );
}
