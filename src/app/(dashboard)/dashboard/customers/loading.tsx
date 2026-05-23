import { PageHeaderSkeleton, FilterBarSkeleton, TableSkeleton } from "@/components/ui/skeleton";

export default function CustomersLoading() {
  return (
    <div className="space-y-5">
      <PageHeaderSkeleton />
      <FilterBarSkeleton inputs={1} />
      <TableSkeleton rows={8} cols={5} />
    </div>
  );
}
