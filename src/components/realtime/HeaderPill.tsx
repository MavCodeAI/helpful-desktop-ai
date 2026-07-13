import { Settings2, History, StickyNote, MessageSquare } from "lucide-react";
import { useNotes } from "@/lib/utilities/notes";
import type { Pace, ProviderId } from "@/lib/voice-providers";

type Props = {
  provider: ProviderId;
  currentVoice: string;
  pace: Pace;
  rate: number;
  threadCount: number;
  onOpenHistory: () => void;
  onOpenSettings: () => void;
  onOpenNotes: () => void;
  onOpenChat: () => void;
};

export function HeaderPill({
  provider, currentVoice, pace, rate, threadCount, onOpenHistory, onOpenSettings, onOpenNotes, onOpenChat,
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
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenChat}
          className="text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 border border-white/10 rounded-full flex items-center gap-1.5 hover:border-cyan-400/40 transition-colors"
          aria-label="Open chat"
          title="Chat"
        >
          <MessageSquare className="w-3.5 h-3.5 text-cyan-300/90" strokeWidth={1.75} />
          <span className="hidden sm:inline">Chat</span>
        </button>
        <button
          onClick={onOpenNotes}
          className="text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 border border-white/10 rounded-full flex items-center gap-1.5 hover:border-cyan-400/40 transition-colors"
          aria-label="Open notes"
          title="Notes"
        >
          <StickyNote className="w-3.5 h-3.5 text-cyan-300/90" strokeWidth={1.75} />
          <span className="hidden sm:inline">Notes</span>
          {noteCount > 0 && <span className="text-muted-foreground tabular-nums">{noteCount}</span>}
        </button>
        <button
          onClick={onOpenHistory}
          className="text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 border border-white/10 rounded-full flex items-center gap-1.5 hover:border-cyan-400/40 transition-colors"
          aria-label="Open conversation history"
          title="History"
        >
          <History className="w-3.5 h-3.5 text-cyan-300/90" strokeWidth={1.75} />
          <span className="hidden sm:inline">History</span>
          <span className="text-muted-foreground tabular-nums">{threadCount}</span>
        </button>
        <div className="hidden lg:flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
          <span className="truncate max-w-[80px] normal-case tracking-normal">{currentVoice}</span>
          <span>·</span>
          <span className="normal-case tracking-normal">{pace} · {rate}×</span>
        </div>
        <button
          onClick={onOpenSettings}
          className="text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 border border-white/10 rounded-full flex items-center gap-1.5 hover:border-cyan-400/40 transition-colors"
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