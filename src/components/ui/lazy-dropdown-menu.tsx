/**
 * LazyDropdownMenu — defers Radix DropdownMenu (~40 KB with Menu + Popper +
 * Portal + focus scope) out of the main /jarvis chunk. Same pattern as
 * LazySheet: plain button trigger, Radix subtree mounts on first open,
 * prefetch on hover/focus.
 *
 * `children` receives the Radix primitives resolved from the lazy module
 * so callers can build their own menu content without a static import.
 */
import { lazy, Suspense, useState, type ComponentType, type ReactNode } from "react";

type DropdownModule = typeof import("./dropdown-menu");
export type DropdownMenuParts = {
  Content: DropdownModule["DropdownMenuContent"];
  Item: DropdownModule["DropdownMenuItem"];
  Label: DropdownModule["DropdownMenuLabel"];
  Separator: DropdownModule["DropdownMenuSeparator"];
};

let dropdownPrefetched = false;
export function prefetchDropdownMenu(): void {
  if (dropdownPrefetched) return;
  dropdownPrefetched = true;
  void import("./dropdown-menu");
}

type ImplProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  align?: "start" | "center" | "end";
  contentClassName?: string;
  render: (parts: DropdownMenuParts) => ReactNode;
};

const DropdownImpl: ComponentType<ImplProps> = lazy(async () => {
  const m = await import("./dropdown-menu");
  const parts: DropdownMenuParts = {
    Content: m.DropdownMenuContent,
    Item: m.DropdownMenuItem,
    Label: m.DropdownMenuLabel,
    Separator: m.DropdownMenuSeparator,
  };
  return {
    default: function Impl({ open, onOpenChange, align, contentClassName, render }: ImplProps) {
      // We render Content controlled: the DropdownMenu root owns open state
      // via `open`/`onOpenChange`. No visible Trigger — the parent's plain
      // button drives it, and Radix's focus/portal semantics still work
      // because Content is a portal-rendered popper anchored to body.
      // Anchoring falls back to viewport center without a trigger; supply
      // an invisible anchor so it aligns to where the trigger sits.
      return (
        <m.DropdownMenu open={open} onOpenChange={onOpenChange}>
          <m.DropdownMenuTrigger asChild>
            <span aria-hidden className="sr-only" />
          </m.DropdownMenuTrigger>
          <parts.Content align={align} className={contentClassName}>
            {render(parts)}
          </parts.Content>
        </m.DropdownMenu>
      );
    },
  };
});

export interface LazyDropdownTriggerProps {
  onClick: () => void;
  onPointerEnter: () => void;
  onFocus: () => void;
  "aria-expanded": boolean;
  "aria-haspopup": "menu";
}

export function LazyDropdownMenu({
  trigger,
  align,
  contentClassName,
  children,
}: {
  trigger: (props: LazyDropdownTriggerProps) => ReactNode;
  align?: "start" | "center" | "end";
  contentClassName?: string;
  children: (parts: DropdownMenuParts) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const toggle = () => {
    setMounted(true);
    setOpen((v) => !v);
  };

  return (
    <>
      {trigger({
        onClick: toggle,
        onPointerEnter: prefetchDropdownMenu,
        onFocus: prefetchDropdownMenu,
        "aria-expanded": open,
        "aria-haspopup": "menu",
      })}
      {mounted && (
        <Suspense fallback={null}>
          <DropdownImpl
            open={open}
            onOpenChange={setOpen}
            align={align}
            contentClassName={contentClassName}
            render={children}
          />
        </Suspense>
      )}
    </>
  );
}
