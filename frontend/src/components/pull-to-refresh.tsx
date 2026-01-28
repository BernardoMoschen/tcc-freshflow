import { ReactNode } from "react";
import { Loader2, ArrowDown } from "lucide-react";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { cn } from "@/lib/utils";

interface PullToRefreshProps {
  children: ReactNode;
  onRefresh: () => Promise<void>;
  threshold?: number;
  disabled?: boolean;
  className?: string;
}

/**
 * Pull-to-refresh wrapper component for mobile.
 * Wrap your scrollable content with this component to enable pull-to-refresh.
 */
export function PullToRefresh({
  children,
  onRefresh,
  threshold = 80,
  disabled = false,
  className,
}: PullToRefreshProps) {
  const { containerRef, isPulling, pullDistance, isRefreshing } = usePullToRefresh({
    onRefresh,
    threshold,
    disabled,
  });

  // Calculate indicator opacity based on pull distance
  const indicatorOpacity = Math.min(pullDistance / threshold, 1);
  const shouldShowIndicator = isPulling || isRefreshing;

  // Calculate rotation for arrow (rotates to point up when ready to refresh)
  const arrowRotation = Math.min((pullDistance / threshold) * 180, 180);
  const isReadyToRefresh = pullDistance >= threshold;

  return (
    <div className={cn("relative", className)}>
      {/* Pull-to-refresh indicator */}
      <div
        className={cn(
          "absolute left-0 right-0 flex justify-center items-center transition-all duration-200 z-10 pointer-events-none",
          shouldShowIndicator ? "opacity-100" : "opacity-0"
        )}
        style={{
          top: Math.max(pullDistance - 40, 0),
          transform: `translateY(${isPulling ? 0 : -40}px)`,
        }}
      >
        <div
          className={cn(
            "bg-white rounded-full shadow-md p-2 transition-colors",
            isReadyToRefresh && !isRefreshing && "bg-green-50"
          )}
          style={{ opacity: indicatorOpacity }}
        >
          {isRefreshing ? (
            <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
          ) : (
            <ArrowDown
              className={cn(
                "w-5 h-5 transition-colors",
                isReadyToRefresh ? "text-green-600" : "text-gray-600"
              )}
              style={{ transform: `rotate(${arrowRotation}deg)` }}
            />
          )}
        </div>
      </div>

      {/* Scrollable content */}
      <div
        ref={containerRef}
        className={cn(
          "h-full overflow-y-auto",
          isPulling && "touch-none"
        )}
        style={{
          transform: isPulling ? `translateY(${pullDistance}px)` : undefined,
          transition: isPulling ? "none" : "transform 0.2s ease-out",
        }}
      >
        {children}
      </div>
    </div>
  );
}
