import type { ReactNode } from "react";

export function SectionHeader({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-[11px] uppercase tracking-[0.2em] text-white/60 font-semibold mb-2.5">
      {children}
    </h3>
  );
}
