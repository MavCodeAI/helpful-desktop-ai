import { useEffect, type RefObject } from "react";

/**
 * Swipe-to-close for edge drawers.
 * `direction` = the side the drawer opens from ("left" drawer is dismissed by swiping left).
 * Applies a live translateX during drag; commits close once past ~25% of drawer width or 80px.
 * Skips gesture if user starts by scrolling vertically (list scroll inside drawer).
 */
export function useSwipeClose(
  ref: RefObject<HTMLElement | null>,
  direction: "left" | "right",
  onClose: () => void,
  active: boolean,
) {
  useEffect(() => {
    if (!active) return;
    const el = ref.current;
    if (!el) return;
    let startX = 0, startY = 0, dx = 0;
    let dragging = false, gestureLocked = false;

    const reset = () => {
      el.style.transform = "";
      el.style.transition = "";
    };
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      dx = 0;
      dragging = true;
      gestureLocked = false;
      el.style.transition = "none";
    };
    const onMove = (e: TouchEvent) => {
      if (!dragging) return;
      const cx = e.touches[0].clientX - startX;
      const cy = e.touches[0].clientY - startY;
      if (!gestureLocked) {
        // Wait for a clear axis; vertical wins → let list scroll.
        if (Math.abs(cx) < 6 && Math.abs(cy) < 6) return;
        if (Math.abs(cy) > Math.abs(cx)) { dragging = false; return; }
        gestureLocked = true;
      }
      dx = direction === "left" ? Math.min(0, cx) : Math.max(0, cx);
      el.style.transform = `translateX(${dx}px)`;
    };
    const onEnd = () => {
      if (!dragging) { reset(); return; }
      dragging = false;
      el.style.transition = "transform 0.2s ease";
      const width = el.getBoundingClientRect().width;
      const threshold = Math.min(80, width * 0.25);
      if (Math.abs(dx) > threshold) {
        el.style.transform = `translateX(${direction === "left" ? -width : width}px)`;
        window.setTimeout(() => { reset(); onClose(); }, 180);
      } else {
        el.style.transform = "";
      }
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: true });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
      reset();
    };
  }, [ref, direction, onClose, active]);
}

/**
 * Keyboard focus trap for a modal/drawer.
 * On activate: moves focus to first focusable inside `ref`, cycles Tab/Shift+Tab
 * so keyboard users can't escape into the (inert) page behind. On deactivate:
 * restores focus to whatever was focused before the overlay opened.
 */
const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),' +
  'textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const el = ref.current;
    if (!el) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Defer initial focus so it lands after any autoFocus / transition.
    const t = window.setTimeout(() => {
      const items = el.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (items.length && !el.contains(document.activeElement)) items[0].focus();
    }, 30);

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter((n) => n.offsetParent !== null || n === document.activeElement);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const activeEl = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (activeEl === first || !el.contains(activeEl))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (activeEl === last || !el.contains(activeEl))) {
        e.preventDefault();
        first.focus();
      }
    };
    el.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      el.removeEventListener("keydown", onKey);
      // Restore focus only if it's still inside the closing overlay.
      if (previouslyFocused && el.contains(document.activeElement)) {
        previouslyFocused.focus?.();
      }
    };
  }, [ref, active]);
}