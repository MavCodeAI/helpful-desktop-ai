/**
 * LazyDropdownMenu — defers Radix DropdownMenu (~40 KB with Menu + Popper +
 * Portal + focus scope) out of the main /jarvis chunk.
 *
 * Pattern: caller provides a `triggerButton` React element. Before first
 * open we render that button directly with an onClick that (a) prefetches
 * the chunk, (b) flips `mounted=true`. Once mounted, Suspense holds the
 * same button as its fallback; when the chunk resolves, Radix takes over
 * via `defaultOpen`, correctly anchoring the menu to the real button.
 * Prefetch also fires on pointer/focus so the chunk is warm before click.
 */
import {
  cloneElement,
  isValidElement,
  lazy,
  Suspense,
  useRef,
  useState,
  type ComponentType,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from "react";

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
  triggerButton: ReactElement;
  align?: "start" | "center" | "end";
  contentClassName?: string;
  render: (parts: DropdownMenuParts) => ReactNode;
  onClose: () => void;
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
    default: function Impl({ triggerButton, align, contentClassName, render, onClose }: ImplProps) {
      return (
        <m.DropdownMenu
          defaultOpen
          onOpenChange={(o) => {
            if (!o) onClose();
          }}
        >
          <m.DropdownMenuTrigger asChild>{triggerButton}</m.DropdownMenuTrigger>
          <parts.Content align={align} className={contentClassName}>
            {render(parts)}
          </parts.Content>
        </m.DropdownMenu>
      );
    },
  };
});

export function LazyDropdownMenu({
  triggerButton,
  align,
  contentClassName,
  children,
}: {
  triggerButton: ReactElement;
  align?: "start" | "center" | "end";
  contentClassName?: string;
  children: (parts: DropdownMenuParts) => ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);

  const open = () => {
    prefetchDropdownMenu();
    setMounted(true);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    // Match Radix DropdownMenuTrigger keyboard behavior on the pre-mount button:
    // Enter / Space / ArrowDown / ArrowUp all open the menu.
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      open();
    }
  };

  if (!mounted) {
    if (!isValidElement<Record<string, unknown>>(triggerButton)) return null;
    return cloneElement(triggerButton, {
      ref: (node: HTMLElement | null) => {
        triggerRef.current = node;
      },
      onClick: open,
      onKeyDown: handleKeyDown,
      onPointerEnter: prefetchDropdownMenu,
      onFocus: prefetchDropdownMenu,
      "aria-haspopup": "menu",
      "aria-expanded": false,
    });
  }

  return (
    <Suspense fallback={triggerButton}>
      <DropdownImpl
        triggerButton={triggerButton}
        align={align}
        contentClassName={contentClassName}
        render={children}
        onClose={() => {
          // Restore focus to the trigger after Escape / outside-click close,
          // then unmount Radix so the chunk is idle until next open.
          setMounted(false);
          queueMicrotask(() => triggerRef.current?.focus());
        }}
      />
    </Suspense>
  );
}
