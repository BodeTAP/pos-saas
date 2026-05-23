import { PageHeaderSkeleton, TableSkeleton } from "@/components/ui/skeleton";

export default function StaffLoading() {
  return (
    <div className="space-y-5">
      <PageHeaderSkeleton />
      <TableSkeleton rows={6} cols={5} />
    </div>
  );
}
