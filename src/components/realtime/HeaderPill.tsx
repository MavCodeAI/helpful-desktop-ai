import { Settings2, History, StickyNote, MessageSquare } from "lucide-react";
import { useNotes } from "@/lib/utilities/notes";
import type { Pace, ProviderId } from "@/lib/voice-providers";

type Props = {
  provider: ProviderId;
  currentVoice: string;
  pace: Pace;
  rate: number;
  threadCount: number;
  messageCount: number;
  onOpenHistory: () => void;
  onOpenSettings: () => void;
  onOpenNotes: () => void;
  onOpenChat: () => void;
};

function Badge({ n, tone = "cyan" }: { n: number; tone?: "cyan" | "violet" | "amber" }) {
  if (n <= 0) return null;
  const cls =
    tone === "violet"
      ? "bg-violet-400/20 text-violet-100 border-violet-400/40"
      : tone === "amber"
      ? "bg-amber-400/20 text-amber-100 border-amber-400/40"
      : "bg-cyan-400/20 text-cyan-100 border-cyan-400/40";
  return (
    <span
      className={`ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full border text-[10px] font-semibold tabular-nums ${cls}`}
      aria-label={`${n} items`}
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}

export function HeaderPill({
  provider, currentVoice, pace, rate, threadCount, messageCount,
  onOpenHistory, onOpenSettings, onOpenNotes, onOpenChat,
}: Props) {
  const { notes } = useNotes();
  const noteCount = notes.length;
  return (
    <header className="relative z-10 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 mx-3 sm:mx-6 mt-3 sm:mt-4 px-3 sm:px-6 py-2.5 glass-pill rounded-full">
      <div className="flex min-w-0 items-center gap-2">
        <img
          src="/alpha-icon.png"
          alt="Alpha logo"
          width={24}
          height={24}
          className="w-6 h-6 shrink-0 rounded-md ring-1 ring-cyan-400/30"
          loading="lazy"
        />
        <div className="hidden sm:block truncate text-xs tracking-widest uppercase text-muted-foreground">
          Alpha · Realtime
        </div>
      </div>
      <div className="flex items-center gap-1.5 sm:gap-2">
        <button
          onClick={onOpenChat}
          className="min-h-10 min-w-10 text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 border border-white/10 rounded-full flex items-center justify-center gap-1.5 hover:border-cyan-400/40 transition-colors touch-manipulation"
          aria-label={messageCount > 0 ? `Open chat, ${messageCount} messages` : "Open chat"}
          title="Chat"
        >
          <MessageSquare className="w-3.5 h-3.5 text-cyan-300/90" strokeWidth={1.75} />
          <span className="hidden sm:inline">Chat</span>
          <Badge n={messageCount} tone="cyan" />
        </button>
        <button
          onClick={onOpenNotes}
          className="min-h-10 min-w-10 text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 border border-white/10 rounded-full flex items-center justify-center gap-1.5 hover:border-cyan-400/40 transition-colors touch-manipulation"
          aria-label={noteCount > 0 ? `Open notes, ${noteCount} saved` : "Open notes"}
          title="Notes"
        >
          <StickyNote className="w-3.5 h-3.5 text-cyan-300/90" strokeWidth={1.75} />
          <span className="hidden sm:inline">Notes</span>
          <Badge n={noteCount} tone="amber" />
        </button>
        <button
          onClick={onOpenHistory}
          className="min-h-10 min-w-10 text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 border border-white/10 rounded-full flex items-center justify-center gap-1.5 hover:border-cyan-400/40 transition-colors touch-manipulation"
          aria-label={threadCount > 0 ? `Open conversation history, ${threadCount} threads` : "Open conversation history"}
          title="History"
        >
          <History className="w-3.5 h-3.5 text-cyan-300/90" strokeWidth={1.75} />
          <span className="hidden sm:inline">History</span>
          <Badge n={threadCount} tone="violet" />
        </button>
        <div className="hidden lg:flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
          <span className="truncate max-w-[80px] normal-case tracking-normal">{currentVoice}</span>
          <span>·</span>
          <span className="normal-case tracking-normal">{pace} · {rate}×</span>
        </div>
        <button
          onClick={onOpenSettings}
          className="min-h-10 min-w-10 text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 border border-white/10 rounded-full flex items-center justify-center gap-1.5 hover:border-cyan-400/40 transition-colors touch-manipulation"
          aria-label="Open voice settings"
          title="Voice settings"
        >
          <Settings2 className="w-3.5 h-3.5 text-cyan-300/90" strokeWidth={1.75} />
          <span className="hidden sm:inline">Settings</span>
        </button>
      </div>
    </header>
  );
}
