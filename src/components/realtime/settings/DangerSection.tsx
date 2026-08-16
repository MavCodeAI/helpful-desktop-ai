import { toast } from "sonner";
import { useUILang } from "@/hooks/use-ui-lang";
import { SectionHeader } from "./SectionHeader";

interface Props {
  clearMemories: () => void;
}

/** Danger zone — reset preferences, clear memory, wipe browser state. */
export function DangerSection({ clearMemories }: Props) {
  const { isUrdu } = useUILang();

  const clearAll = () => {
    if (!window.confirm(isUrdu ? "تمام مقامی ڈیٹا صاف کریں؟" : "Clear all local data?")) return;
    try {
      // Wipe Alpha-owned preferences plus session-scoped API keys only; never touch unrelated app storage.
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        if (
          k.startsWith("alpha_") ||
          k.startsWith("jarvis.") ||
          k.startsWith("api_settings_") ||
          k === "gemini_api_key" ||
          k === "tavily_api_key"
        ) keys.push(k);
      }
      keys.forEach((k) => localStorage.removeItem(k));
      ["gemini_api_key", "tavily_api_key", "gemini_api_key_validated"].forEach((k) => sessionStorage.removeItem(k));
      toast.success(isUrdu ? "صاف ہو گیا — دوبارہ لوڈ ہو رہا ہے" : "Cleared — reloading");
      setTimeout(() => window.location.reload(), 600);
    } catch {
      toast.error(isUrdu ? "صاف نہیں ہو سکا" : "Could not clear");
    }
  };

  return (
    <section>
      <SectionHeader>{isUrdu ? "خطرناک زون" : "Danger zone"}</SectionHeader>
      <div className="space-y-1.5">
        <button
          onClick={() => {
            if (!window.confirm(isUrdu ? "تمام یادیں صاف کریں؟" : "Clear all memories?")) return;
            clearMemories();
          }}
          className="w-full text-xs px-3 py-2.5 rounded-md border border-amber-400/25 bg-amber-500/5 text-amber-200/90 hover:bg-amber-500/10 transition min-h-11"
        >
          {isUrdu ? "تمام یادیں صاف کریں" : "Clear all memories"}
        </button>
        <button
          onClick={clearAll}
          className="w-full text-xs px-3 py-2.5 rounded-md border border-red-400/25 bg-red-500/5 text-red-200/90 hover:bg-red-500/10 transition min-h-11"
        >
          {isUrdu ? "تمام مقامی ڈیٹا صاف کریں اور دوبارہ لوڈ کریں" : "Clear all local data & reload"}
        </button>
      </div>
    </section>
  );
}
