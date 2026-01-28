import { useEffect, useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

/**
 * Shows a progress bar during page transitions.
 * Detects route changes via useLocation and shows a brief loading animation.
 */
export function NavigationProgress() {
  const location = useLocation();
  const [progress, setProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const previousPathRef = useRef(location.pathname);

  useEffect(() => {
    // Only show progress when path actually changes
    if (previousPathRef.current !== location.pathname) {
      previousPathRef.current = location.pathname;

      // Start progress animation
      setIsVisible(true);
      setProgress(30);

      // Simulate progress
      intervalRef.current = window.setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
            }
            return 90;
          }
          const increment = Math.max(1, (90 - prev) / 5);
          return prev + increment;
        });
      }, 50);

      // Complete after a short delay (simulating page load)
      const completeTimer = setTimeout(() => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        setProgress(100);

        // Hide after animation
        setTimeout(() => {
          setIsVisible(false);
          setProgress(0);
        }, 200);
      }, 300);

      return () => {
        clearTimeout(completeTimer);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [location.pathname]);

  if (!isVisible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-gray-200/50">
      <div
        className={cn(
          "h-full bg-primary transition-all duration-200 ease-out",
          progress === 100 && "opacity-0"
        )}
        style={{ width: `${progress}%` }}
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Page loading"
      />
    </div>
  );
}

/**
 * Simple global loading indicator for API calls.
 * Shows a subtle spinner in the corner during async operations.
 */
export function GlobalLoadingIndicator({ isLoading }: { isLoading: boolean }) {
  if (!isLoading) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 bg-white rounded-full p-2 shadow-lg"
      role="status"
      aria-label="Loading"
    >
      <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
