import { useEffect, useRef } from "react";

/**
 * Mirrors a value into a ref so callers can consume the latest reference
 * without re-subscribing. Cheaper and cleaner than a bespoke `useRef` +
 * `useEffect` pair at every call site.
 */
export function useMutableRef<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => { ref.current = value; }, [value]);
  return ref;
}