import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { loadLang } from "@/lib/persona";

function useOnline() {
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);
  return online;
}

/**
 * Slim top banner shown only when the browser reports offline. Non-blocking,
 * dismisses itself automatically when the network returns.
 */
export function OfflineBanner() {
  const online = useOnline();
  const lang = typeof window === "undefined" ? "auto" : loadLang();
  const isUrdu = lang === "ur";
  const isArabic = lang === "ar";
  if (online) return null;
  const msg = isArabic
    ? "غير متصل — بانتظار الشبكة…"
    : isUrdu
      ? "آف لائن — نیٹ ورک کا انتظار…"
      : "Offline — waiting for network…";
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 border-b border-amber-400/40 bg-amber-500/15 px-3 py-1.5 text-[11px] font-medium text-amber-100 backdrop-blur-md"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 6px)" }}
    >
      <WifiOff className="h-3.5 w-3.5" aria-hidden />
      <span>{msg}</span>
    </div>
  );
}
