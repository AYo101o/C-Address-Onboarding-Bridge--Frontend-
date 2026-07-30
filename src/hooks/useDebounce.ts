import { useState, useEffect } from "react";

/**
 * Delays updating the returned value until the input has stopped changing
 * for `delay` milliseconds. Useful for deferring expensive validation on
 * fast-changing inputs (e.g. address fields) without blocking the visible
 * input value.
 *
 * @param value - The value to debounce
 * @param delay - Debounce delay in milliseconds (default 200)
 * @returns The debounced value
 */
export function useDebounce<T>(value: T, delay: number = 200): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
