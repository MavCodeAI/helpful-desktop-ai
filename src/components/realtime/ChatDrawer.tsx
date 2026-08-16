import { useEffect, useRef, useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { useFocusTrap, useSwipeClose } from "@/hooks/use-drawer-a11y";
import { MessageBubble } from "@/components/realtime/MessageBubble";
import { ChatComposer } from "@/components/realtime/ChatComposer";
import type { VoiceMessage } from "@/lib/voice-providers";
import type { LangCode } from "@/lib/persona";

export interface ChatDrawerProps {
  open: boolean;
  onClose: () => void;
  messages: VoiceMessage[];
  lang?: LangCode;
  onSend: (text: string) => void | Promise<void>;
  busy?: boolean;
  onNote?: (text: string) => void | Promise<void>;
  notePending?: boolean;
  onClear: () => void;
  onNewChat: () => void;
}

export function ChatDrawer({
  open,
  onClose,
  messages,
  lang,
  onSend,
  busy,
  onNote,
  notePending,
  onClear,
  onNewChat,
}: ChatDrawerProps) {
  const drawerRef = useRef<HTMLElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const isUrdu = false;

  useSwipeClose(drawerRef, "right", onClose, open);
  useFocusTrap(drawerRef, open);

  useEffect(() => {
    if (!open) return;
    endRef.current?.scrollIntoView({ block: "end" });
  }, [open, messages.length]);

  useEffect(() => {
    if (!confirmClear) return;
    const t = setTimeout(() => setConfirmClear(false), 4000);
    return () => clearTimeout(t);
  }, [confirmClear]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Chat"
        className="glass fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col rounded-none border-l sm:rounded-l-2xl"
        style={{ animation: "slideInRight 220ms ease-out" }}
      >
        <header className="flex items-center gap-2 border-b border-border px-4 py-3">
          <h2 className="flex-1 text-sm font-semibold tracking-wide">Chat</h2>
          <button
            onClick={() => {
              onNewChat();
              setConfirmClear(false);
            }}
            className="glass-item flex min-h-10 items-center gap-1 rounded-full px-3 py-2 text-[11px] touch-manipulation"
            title="New chat"
          >
            <Plus className="h-3.5 w-3.5" /> {isUrdu ? "نئی گفتگو" : "New"}
          </button>
          <button
            onClick={() => {
              if (confirmClear) {
                onClear();
                setConfirmClear(false);
              } else {
                setConfirmClear(true);
              }
            }}
            className={`glass-item flex min-h-10 items-center gap-1 rounded-full px-3 py-2 text-[11px] touch-manipulation ${confirmClear ? "glass-item-danger" : ""}`}
            title="Clear chat"
          >
            <Trash2 className="h-3.5 w-3.5" /> {confirmClear ? (isUrdu ? "یقین ہے؟" : "Sure?") : (isUrdu ? "صاف کریں" : "Clear")}
          </button>
          <button
            onClick={onClose}
            className="glass-item ml-1 grid min-h-11 min-w-11 place-items-center rounded-full touch-manipulation"
            aria-label="Close chat"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {messages.length === 0 ? (
            <p className="mt-8 text-center text-xs text-muted-foreground">
              {isUrdu ? "ابھی کوئی پیغام نہیں — کچھ کہیں یا نیچے لکھیں۔" : "No messages yet — say something or type below."}
            </p>
          ) : (
            messages.map((m, i) => (
              <MessageBubble key={`${m.role}-${i}`} role={m.role} text={m.text} />
            ))
          )}
          <div ref={endRef} />
        </div>
        <div className="border-t border-border p-3">
          <ChatComposer
            lang={lang}
            onSend={onSend}
            busy={busy}
            onNote={onNote}
            notePending={notePending}
            autoFocus
          />
        </div>
      </aside>
    </>
  );
}
