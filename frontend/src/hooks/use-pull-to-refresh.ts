import { useRef, useEffect, useCallback, useState } from "react";

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number;
  disabled?: boolean;
}

interface UsePullToRefreshReturn {
  containerRef: React.RefObject<HTMLDivElement>;
  isPulling: boolean;
  pullDistance: number;
  isRefreshing: boolean;
}

/**
 * Hook for implementing pull-to-refresh functionality on mobile.
 * Attach containerRef to the scrollable container element.
 */
export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  disabled = false,
}: UsePullToRefreshOptions): UsePullToRefreshReturn {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const startYRef = useRef<number | null>(null);
  const currentYRef = useRef<number>(0);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (disabled || isRefreshing) return;

      const container = containerRef.current;
      if (!container) return;

      // Only start pull-to-refresh when at the top of the scroll container
      if (container.scrollTop > 0) return;

      startYRef.current = e.touches[0].clientY;
      currentYRef.current = 0;
    },
    [disabled, isRefreshing]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (disabled || isRefreshing || startYRef.current === null) return;

      const container = containerRef.current;
      if (!container) return;

      // Only process if at top of scroll
      if (container.scrollTop > 0) {
        startYRef.current = null;
        setIsPulling(false);
        setPullDistance(0);
        return;
      }

      const currentY = e.touches[0].clientY;
      const diff = currentY - startYRef.current;

      // Only process downward pulls
      if (diff > 0) {
        // Apply resistance (pull distance decreases as you pull further)
        const resistance = 0.5;
        const resistedDiff = diff * resistance;

        currentYRef.current = resistedDiff;
        setIsPulling(true);
        setPullDistance(Math.min(resistedDiff, threshold * 1.5));

        // Prevent scroll when pulling
        if (resistedDiff > 10) {
          e.preventDefault();
        }
      }
    },
    [disabled, isRefreshing, threshold]
  );

  const handleTouchEnd = useCallback(async () => {
    if (disabled || isRefreshing || startYRef.current === null) return;

    const distance = currentYRef.current;

    // Reset pull state
    setIsPulling(false);
    setPullDistance(0);
    startYRef.current = null;

    // Trigger refresh if threshold exceeded
    if (distance >= threshold) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } catch (error) {
        console.error("Pull-to-refresh error:", error);
      } finally {
        setIsRefreshing(false);
      }
    }
  }, [disabled, isRefreshing, threshold, onRefresh]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || disabled) return;

    // Use passive: false for touchmove to allow preventDefault
    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchmove", handleTouchMove, { passive: false });
    container.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, disabled]);

  return {
    containerRef,
    isPulling,
    pullDistance,
    isRefreshing,
  };
}
