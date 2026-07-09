import { useCallback, useEffect, useRef, useState } from "react";
import type { VoiceMessage, VoiceStatus } from "@/lib/voice-providers";

type Options = {
  messages: VoiceMessage[];
  partial: VoiceMessage | null;
  status: VoiceStatus;
};

/**
 * Sticky-to-bottom scroll behavior for the message rail.
 * Smooth-scrolls on finalized messages / status changes; instant on partial
 * tokens so rapid updates don't queue laggy smooth-scrolls.
 * Tracks whether the user has scrolled away and counts unread assistant
 * messages while away.
 */
export function useAutoScroll({ messages, partial, status }: Options) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !atBottom) return;
    const id = requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    });
    return () => cancelAnimationFrame(id);
  }, [messages, atBottom, status]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !atBottom || !partial) return;
    const id = requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
    return () => cancelAnimationFrame(id);
  }, [partial, atBottom]);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    const isAt = dist < 40;
    setAtBottom(isAt);
    if (isAt) setUnread(0);
  }, []);

  const jumpToLatest = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    setAtBottom(true);
    setUnread(0);
  }, []);

  const bumpUnread = useCallback(() => setUnread((n) => n + 1), []);

  return { scrollRef, atBottom, unread, onScroll, jumpToLatest, bumpUnread };
}