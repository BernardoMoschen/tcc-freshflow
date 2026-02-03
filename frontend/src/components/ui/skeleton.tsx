export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-muted rounded ${className}`} />
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-card rounded-xl shadow-sm p-5 md:p-6">
      <div className="animate-pulse">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <Skeleton className="h-6 w-3/4 mb-2" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    </div>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="bg-card rounded-xl shadow-sm overflow-hidden">
      <Skeleton className="h-48 w-full rounded-none" />
      <div className="p-4">
        <Skeleton className="h-6 w-3/4 mb-2" />
        <Skeleton className="h-4 w-1/2 mb-3" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}

export function OrderItemSkeleton() {
  return (
    <div className="bg-card rounded-xl shadow-sm p-5 md:p-6">
      <div className="animate-pulse">
        <Skeleton className="h-6 w-2/3 mb-3" />
        <Skeleton className="h-4 w-1/3 mb-2" />
        <Skeleton className="h-4 w-1/2 mb-4" />
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      </div>
    </div>
  );
}

export function OrderDetailsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Status Timeline */}
      <div className="bg-muted rounded-lg p-4">
        <div className="flex justify-between">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      </div>

      {/* Order Info */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-5 w-32" />
        </div>
        <div>
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="col-span-2">
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-5 w-48" />
        </div>
      </div>

      {/* Separator */}
      <Skeleton className="h-px w-full" />

      {/* Items Header */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-5 rounded" />
        <Skeleton className="h-5 w-24" />
      </div>

      {/* Items */}
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="border rounded-lg p-4 bg-muted">
            <div className="flex justify-between mb-3">
              <div className="flex-1">
                <Skeleton className="h-4 w-2/3 mb-2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        ))}
      </div>

      {/* Separator */}
      <Skeleton className="h-px w-full" />

      {/* Total */}
      <div className="flex justify-between">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-6 w-24" />
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 flex-1" />
      </div>
    </div>
  );
}

export function TableRowSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <tr>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}

export function ListSkeleton({ items = 5 }: { items?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 bg-card rounded-lg">
          <Skeleton className="h-12 w-12 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  );
}
