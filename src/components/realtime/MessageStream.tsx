import { forwardRef } from "react";
import { MessageBubble, PartialBubble, TypingBubble } from "./MessageBubble";
import { CitedSources } from "./CitedSources";
import { parseCitations } from "./citation-parser";
import type { VoiceMessage, VoiceStatus } from "@/lib/voice-providers";

type Props = {
  messages: VoiceMessage[];
  partial: VoiceMessage | null;
  status: VoiceStatus;
  atBottom: boolean;
  unread: number;
  onScroll: () => void;
  onJumpToLatest: () => void;
};

export const MessageStream = forwardRef<HTMLDivElement, Props>(function MessageStream(
  { messages, partial, status, atBottom, unread, onScroll, onJumpToLatest },
  scrollRef,
) {
  const showTyping =
    (status === "speaking" || status === "connecting") &&
    (!partial || partial.role !== "assistant");
  const showRail = messages.length > 0 || !!partial || showTyping;

  if (!showRail) return null;

  return (
    <>
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex flex-col gap-2.5 sm:gap-3.5 max-h-[50dvh] sm:max-h-80 lg:max-h-[70dvh] overflow-y-auto pr-1 scroll-smooth"
      >
        {messages.map((m, i) => {
          const cited = m.role === "assistant" ? parseCitations(m.text) : { body: m.text, sources: [] };
          return (
            <div key={i}>
              <MessageBubble role={m.role} text={cited.body} />
              {m.role === "assistant" && <CitedSources sources={cited.sources} />}
            </div>
          );
        })}
        {partial && <PartialBubble role={partial.role} text={partial.text} />}
        {showTyping && (
          <TypingBubble label={status === "connecting" ? "connecting" : "typing"} />
        )}
      </div>
      {!atBottom && (
        <button
          onClick={onJumpToLatest}
          className="absolute left-1/2 -translate-x-1/2 bottom-2 px-3 py-1.5 rounded-full text-xs bg-cyan-400/15 border border-cyan-400/30 text-cyan-200 backdrop-blur hover:bg-cyan-400/25 shadow-lg flex items-center gap-1"
        >
          ↓ {unread > 0 ? `${unread} new message${unread > 1 ? "s" : ""}` : "Jump to latest"}
          {unread > 0 && (
            <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-cyan-400 text-[10px] font-semibold text-slate-900">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      )}
    </>
  );
});