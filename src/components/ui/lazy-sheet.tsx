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
  onClick: () => void;
  onPointerEnter: () => void;
  onFocus: () => void;
  "aria-expanded": boolean;
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

  const openSheet = () => {
    setMounted(true);
    setOpen(true);
  };

  return (
    <>
      {trigger({
        onClick: openSheet,
        onPointerEnter: prefetchSheet,
        onFocus: prefetchSheet,
        "aria-expanded": open,
      })}
      {mounted && (
        <Suspense fallback={null}>
          <SheetImpl
            open={open}
            onOpenChange={setOpen}
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
