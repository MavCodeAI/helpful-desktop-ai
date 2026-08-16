import { X, Search } from "lucide-react";

interface Props {
  historyQuery: string;
  setHistoryQuery: (v: string) => void;
  isUrdu: boolean;
}

export function HistorySearch({ historyQuery, setHistoryQuery, isUrdu }: Props) {
  const copy = isUrdu ? { placeholder: "عنوان یا پیغام تلاش کریں…", search: "گفتگو تلاش کریں", clear: "تلاش صاف کریں" } : { placeholder: "Search title or message…", search: "Search conversations", clear: "Clear search" };
  return (
    <div className="relative">
      <Search className={`w-3.5 h-3.5 text-white/60 absolute ${isUrdu ? "right-2.5" : "left-2.5"} top-1/2 -translate-y-1/2 pointer-events-none`} />
      <input
        type="search"
        value={historyQuery}
        onChange={(e) => setHistoryQuery(e.target.value)}
        placeholder={copy.placeholder}
        aria-label={copy.search}
        className={`glass-input w-full rounded-md py-1.5 text-xs ${isUrdu ? "pr-8 pl-8" : "pl-8 pr-8"}`}
      />
      {historyQuery && (
        <button
          onClick={() => setHistoryQuery("")}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded text-white/60 hover:text-white/80 hover:bg-white/5"
          aria-label={copy.clear}
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}