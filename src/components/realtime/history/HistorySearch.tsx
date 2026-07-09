import { X, Search } from "lucide-react";

interface Props {
  historyQuery: string;
  setHistoryQuery: (v: string) => void;
}

export function HistorySearch({ historyQuery, setHistoryQuery }: Props) {
  return (
    <div className="relative">
      <Search className="w-3.5 h-3.5 text-white/60 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      <input
        type="search"
        value={historyQuery}
        onChange={(e) => setHistoryQuery(e.target.value)}
        placeholder="Search title or message…"
        aria-label="Search conversations"
        className="glass-input w-full rounded-md pl-8 pr-8 py-1.5 text-xs"
      />
      {historyQuery && (
        <button
          onClick={() => setHistoryQuery("")}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded text-white/60 hover:text-white/80 hover:bg-white/5"
          aria-label="Clear search"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}