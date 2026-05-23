import { PageHeaderSkeleton, StatCardSkeleton, TableSkeleton } from "@/components/ui/skeleton";

export default function ShiftHistoryLoading() {
  return (
    <div className="space-y-5">
      <PageHeaderSkeleton />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => <StatCardSkeleton key={i} />)}
      </div>
      <TableSkeleton rows={8} cols={6} title="Daftar Transaksi" />
    </div>
  );
}
