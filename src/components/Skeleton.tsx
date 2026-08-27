/**
 * Lightweight skeleton placeholders for loading states.
 *
 * Usage:
 *   <Skeleton className="h-32 w-full" />           — card-sized block
 *   <Skeleton className="h-4 w-3/4" />             — text line
 *   <Skeleton className="h-10 w-10 rounded-full" /> — avatar circle
 */

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-white/[0.06] ${className}`}
      aria-hidden="true"
    />
  );
}

/** Four stat cards matching the dashboard grid. */
export function DashboardSkeleton() {
  return (
    <div className="flex-1 min-w-0 flex flex-col">
      {/* Header */}
      <div className="h-16 px-6 sm:px-8 border-b border-white/10 flex items-center">
        <Skeleton className="h-5 w-40" />
      </div>

      <div className="p-6 sm:p-8 space-y-6">
        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="liquid-glass rounded-2xl p-5 space-y-3">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        </div>

        {/* Campaign cards */}
        <div className="space-y-3">
          <Skeleton className="h-5 w-32" />
          {[...Array(3)].map((_, i) => (
            <div key={i} className="liquid-glass rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
              <div className="flex gap-4">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Campaign detail loading state: header + table rows. */
export function CampaignDetailSkeleton() {
  return (
    <div className="flex-1 min-w-0">
      <div className="p-6 sm:p-8 space-y-6">
        {/* Back button + title */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-7 w-64" />
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="liquid-glass rounded-2xl p-4 space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-16" />
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="liquid-glass rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-white/10 flex justify-between">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-8 w-32 rounded-lg" />
          </div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="px-4 py-3 border-b border-white/5 flex items-center gap-4">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-40 hidden md:block" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-6 w-16 rounded-full ml-auto" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
