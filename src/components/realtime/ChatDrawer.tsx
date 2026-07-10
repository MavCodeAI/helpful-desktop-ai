import { useRef } from "react";
import { X, MessageSquare } from "lucide-react";
import { useFocusTrap, useSwipeClose } from "@/hooks/use-drawer-a11y";
import { MessageBubble } from "@/components/realtime/MessageBubble";
import { ChatComposer } from "@/components/realtime/ChatComposer";
import type { VoiceMessage } from "@/lib/voice-providers";

interface Props {
  open: boolean;
  onClose: () => void;
  messages: VoiceMessage[];
  onSend: (text: string) => void | Promise<void>;
  busy: boolean;
  onNote?: (text: string) => void | Promise<void>;
  notePending?: boolean;
}

export function ChatDrawer({ open, onClose, messages, onSend, busy, onNote, notePending }: Props) {
  const ref = useRef<HTMLElement | null>(null);
  useSwipeClose(ref, "right", onClose, open);
  useFocusTrap(ref, open);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-label="Chat">
      <button aria-label="Close chat" className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <aside
        ref={ref}
        className="glass-card relative h-full w-full max-w-[100vw] sm:w-[440px] rounded-none sm:rounded-l-2xl overflow-hidden flex flex-col"
        style={{ animation: "slideInRight 0.25s ease-out" }}
      >
        <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-3 bg-[oklch(0.13_0.02_240/0.75)] backdrop-blur-xl border-b border-white/10">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-cyan-300" />
            <h2 className="text-sm font-semibold text-white/90">Chat</h2>
            <span className="text-[10px] text-white/50 tabular-nums">{messages.length}</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/5 text-white/60 hover:text-white" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {messages.length === 0 ? (
            <div className="text-center text-xs text-white/50 mt-8 px-4">
              No messages yet. Type below to start chatting.
            </div>
          ) : (
            messages.map((m, i) => <MessageBubble key={i} role={m.role} text={m.text} />)
          )}
        </div>
        <div className="shrink-0 p-3 border-t border-white/10">
          <ChatComposer onSend={onSend} busy={busy} onNote={onNote} notePending={notePending} autoFocus />
        </div>
      </aside>
    </div>
  );
}
