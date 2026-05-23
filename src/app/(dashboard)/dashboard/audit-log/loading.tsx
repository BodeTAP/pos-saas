import { PageHeaderSkeleton, FilterBarSkeleton, TableSkeleton } from "@/components/ui/skeleton";

export default function AuditLogLoading() {
  return (
    <div className="space-y-5">
      <PageHeaderSkeleton hasButton={false} />
      <FilterBarSkeleton inputs={5} />
      <TableSkeleton rows={10} cols={5} />
    </div>
  );
}
