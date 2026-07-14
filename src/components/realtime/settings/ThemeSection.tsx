import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { SectionHeader } from "./SectionHeader";
import { useUILang } from "@/hooks/use-ui-lang";

type ThemeMode = "system" | "light" | "dark";
const KEY = "alpha_theme_mode";

function loadMode(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch { /* ignore */ }
  return "dark";
}

function applyMode(mode: ThemeMode) {
  const root = document.documentElement;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = mode === "dark" || (mode === "system" && prefersDark);
  root.classList.toggle("dark", dark);
  root.dataset.theme = dark ? "dark" : "light";
}

export function ThemeSection() {
  const { isUrdu } = useUILang();
  const [mode, setMode] = useState<ThemeMode>("dark");

  useEffect(() => {
    const m = loadMode();
    setMode(m);
    applyMode(m);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => { if (loadMode() === "system") applyMode("system"); };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const change = (m: ThemeMode) => {
    setMode(m);
    try { localStorage.setItem(KEY, m); } catch { /* ignore */ }
    applyMode(m);
  };

  const opts: { id: ThemeMode; label: string; icon: typeof Sun }[] = [
    { id: "light", label: isUrdu ? "روشن" : "Light", icon: Sun },
    { id: "dark", label: isUrdu ? "تاریک" : "Dark", icon: Moon },
    { id: "system", label: isUrdu ? "سسٹم" : "System", icon: Monitor },
  ];

  return (
    <section>
      <SectionHeader>{isUrdu ? "تھیم" : "Theme"}</SectionHeader>
      <div className="grid grid-cols-3 gap-1.5">
        {opts.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => change(id)}
            aria-pressed={mode === id}
            className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs border transition min-h-11 ${
              mode === id
                ? "bg-white/15 text-white border-white/30"
                : "bg-white/[0.03] text-white/70 border-white/10 hover:bg-white/[0.06]"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>
    </section>
  );
}
