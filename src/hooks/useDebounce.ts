import { useState, useEffect } from "react";

/**
 * Debounces a value by the given delay (ms).
 * The returned value only updates once the input value has been stable for
 * `delay` milliseconds, reducing how often downstream validation runs on
 * rapidly-typed input.
 */
export function useDebounce<T>(value: T, delay: number): T {
  throw new Error('Not implemented: useDebounce');
}
