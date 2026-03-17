/** Optimized hooks to prevent unnecessary re-renders */

import { useCallback, useMemo, useRef, useEffect } from "react";

/**
 * Creates a memoized callback that only changes if dependencies change.
 * Unlike useCallback, this handles complex dependency comparisons.
 */
export function useStableCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps: React.DependencyList
): T {
  const ref = useRef(callback);
  const depsRef = useRef(deps);

  // Update ref if deps changed
  const depsChanged = deps.some((dep, i) => !Object.is(dep, depsRef.current[i]));
  if (depsChanged) {
    depsRef.current = deps;
    ref.current = callback;
  }

  return useCallback((...args: Parameters<T>) => ref.current(...args), [ref]) as T;
}

/**
 * Debounce a value - only updates after delay without changes
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Debounce a callback function
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => callback(...args), delay);
    },
    [callback, delay]
  ) as T;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedCallback;
}

/**
 * Throttle a callback function
 */
export function useThrottledCallback<T extends (...args: any[]) => any>(
  callback: T,
  limit: number
): T {
  const inThrottle = useRef(false);

  const throttledCallback = useCallback(
    (...args: Parameters<T>) => {
      if (!inThrottle.current) {
        callback(...args);
        inThrottle.current = true;
        setTimeout(() => (inThrottle.current = false), limit);
      }
    },
    [callback, limit]
  ) as T;

  return throttledCallback;
}

/**
 * Memoize expensive computations
 */
export function useMemoized<T>(
  factory: () => T,
  deps: React.DependencyList
): T {
  return useMemo(factory, deps);
}

// Need to import useState for useDebounce
import { useState } from "react";