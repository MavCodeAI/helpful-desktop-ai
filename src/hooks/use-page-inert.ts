import { useEffect, useRef } from "react";

/**
 * Marks the page shell inert while any overlay is open — Tab skips it,
 * screen readers ignore it, pointer events are blocked. Returns a ref to
 * attach to the wrapper element.
 */
export function usePageInert(anyOverlay: boolean) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (anyOverlay) el.setAttribute("inert", "");
    else el.removeAttribute("inert");
  }, [anyOverlay]);
  return ref;
}