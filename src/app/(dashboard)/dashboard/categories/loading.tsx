import { PageHeaderSkeleton, TableSkeleton } from "@/components/ui/skeleton";

export default function CategoriesLoading() {
  return (
    <div className="space-y-5">
      <PageHeaderSkeleton />
      <TableSkeleton rows={6} cols={3} />
    </div>
  );
}
