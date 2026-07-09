/**
 * LazySheet — defers Radix Sheet (~90 KB with Dialog + Presence + Portal)
 * out of the main /jarvis chunk. Trigger is a plain button rendered
 * synchronously; the Radix subtree only mounts after the first open.
 *
 * We prefetch on pointer/focus of the trigger so the chunk is warm before
 * click. On slow networks the fallback is `null` (button stays pressed
 * for a beat) — no layout jump.
 */
import { lazy, Suspense, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

let sheetPrefetched = false;
export function prefetchSheet(): void {
  if (sheetPrefetched) return;
  sheetPrefetched = true;
  void import("./sheet");
}

const SheetImpl = lazy(async () => {
  const { Sheet, SheetContent, SheetHeader, SheetTitle } = await import("./sheet");
  return {
    default: function Impl({
      open,
      onOpenChange,
      side,
      title,
      contentClassName,
      children,
    }: {
      open: boolean;
      onOpenChange: (v: boolean) => void;
      side: "left" | "right" | "top" | "bottom";
      title: ReactNode;
      contentClassName?: string;
      children: ReactNode;
    }) {
      return (
        <Sheet open={open} onOpenChange={onOpenChange}>
          <SheetContent side={side} className={contentClassName}>
            <SheetHeader>
              <SheetTitle className="font-display tracking-widest text-jarvis">
                {title}
              </SheetTitle>
            </SheetHeader>
            {children}
          </SheetContent>
        </Sheet>
      );
    },
  };
});

export interface LazySheetTriggerProps {
  ref: (node: HTMLElement | null) => void;
  onClick: () => void;
  onKeyDown: (e: KeyboardEvent<HTMLElement>) => void;
  onPointerEnter: () => void;
  onFocus: () => void;
  "aria-expanded": boolean;
  "aria-haspopup": "dialog";
}

export function LazySheet({
  trigger,
  side,
  title,
  contentClassName,
  children,
}: {
  trigger: (props: LazySheetTriggerProps) => ReactNode;
  side: "left" | "right" | "top" | "bottom";
  title: ReactNode;
  contentClassName?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);

  const openSheet = () => {
    setMounted(true);
    setOpen(true);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    // Native <button> already fires onClick on Enter/Space, but callers may
    // pass a non-button element — normalize activation here.
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openSheet();
    }
  };

  return (
    <>
      {trigger({
        ref: (node) => {
          triggerRef.current = node;
        },
        onClick: openSheet,
        onKeyDown: handleKeyDown,
        onPointerEnter: prefetchSheet,
        onFocus: prefetchSheet,
        "aria-expanded": open,
        "aria-haspopup": "dialog",
      })}
      {mounted && (
        <Suspense fallback={null}>
          <SheetImpl
            open={open}
            onOpenChange={(v) => {
              setOpen(v);
              if (!v) {
                // Radix Dialog restores focus to the previously-focused element,
                // but our trigger may have been re-rendered — ensure focus lands.
                queueMicrotask(() => triggerRef.current?.focus());
              }
            }}
            side={side}
            title={title}
            contentClassName={contentClassName}
          >
            {children}
          </SheetImpl>
        </Suspense>
      )}
    </>
  );
}
