import { PageHeaderSkeleton, FilterBarSkeleton, TableSkeleton } from "@/components/ui/skeleton";

export default function TransactionsLoading() {
  return (
    <div className="space-y-5">
      <PageHeaderSkeleton hasButton={false} />
      <FilterBarSkeleton inputs={4} />
      <TableSkeleton rows={10} cols={6} hasAction={false} />
    </div>
  );
}
