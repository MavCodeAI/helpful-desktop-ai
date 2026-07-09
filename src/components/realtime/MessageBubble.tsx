import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Role = "you" | "assistant";

const MARKDOWN_CLASS =
  "font-sans text-[13px] sm:text-sm leading-relaxed text-white/90 break-words [&_p]:my-1 [&_code]:bg-white/10 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[11px] sm:[&_code]:text-xs [&_pre]:bg-white/5 [&_pre]:p-2.5 sm:[&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:text-xs [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:underline [&_a]:text-cyan-300";

const BUBBLE_SHADOW = { boxShadow: "0 8px 32px rgba(0,0,0,0.35)" } as const;

function roleColor(role: Role) {
  return role === "you" ? "hsl(180 90% 65%)" : "hsl(258 90% 75%)";
}

function bubbleClass(role: Role) {
  return `max-w-[85%] rounded-2xl border border-white/10 p-3 sm:p-4 backdrop-blur-xl animate-fade-in break-words ${
    role === "you"
      ? "ml-auto rounded-br-md bg-cyan-500/10 border-cyan-400/20"
      : "mr-auto rounded-bl-md bg-[#0d1220]/80"
  }`;
}

export const MessageBubble = memo(function MessageBubble({
  role,
  text,
}: {
  role: Role;
  text: string;
}) {
  return (
    <div className={bubbleClass(role)} style={BUBBLE_SHADOW} data-role={role}>
      <div
        className="mb-1.5 text-[10px] font-semibold tracking-[0.25em] uppercase"
        style={{ color: roleColor(role) }}
      >
        {role === "you" ? "You" : "Assistant"}
      </div>
      <div className={MARKDOWN_CLASS}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
      </div>
    </div>
  );
});

export function PartialBubble({ role, text }: { role: Role; text: string }) {
  return (
    <div className={bubbleClass(role)} style={BUBBLE_SHADOW} data-role={role} aria-live="polite">
      <div
        className="mb-1.5 text-[10px] font-semibold tracking-[0.25em] uppercase flex items-center gap-1.5"
        style={{ color: roleColor(role) }}
      >
        <span className="live-dot" aria-hidden />
        {role === "you" ? "You" : "Assistant"} · live
      </div>
      <div className={MARKDOWN_CLASS}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
        <span className="inline-block w-[3px] h-4 ml-1 bg-cyan-300 align-middle animate-pulse rounded-sm" />
      </div>
    </div>
  );
}

export function TypingBubble({ label }: { label: string }) {
  return (
    <div
      className="mr-auto max-w-[85%] rounded-2xl rounded-bl-md border border-white/10 bg-[#0d1220]/80 p-3 sm:p-4 backdrop-blur-xl animate-fade-in"
      style={BUBBLE_SHADOW}
      aria-live="polite"
    >
      <div
        className="mb-1.5 text-[10px] font-semibold tracking-[0.25em] uppercase flex items-center gap-1.5"
        style={{ color: roleColor("assistant") }}
      >
        <span className="live-dot" aria-hidden />
        Assistant · {label}
      </div>
      <div className="flex items-center gap-1.5 h-5" aria-label="Assistant is typing">
        <span className="w-1.5 h-1.5 rounded-full bg-violet-300/90 animate-pulse" style={{ animationDelay: "0ms" }} />
        <span className="w-1.5 h-1.5 rounded-full bg-violet-300/90 animate-pulse" style={{ animationDelay: "180ms" }} />
        <span className="w-1.5 h-1.5 rounded-full bg-violet-300/90 animate-pulse" style={{ animationDelay: "360ms" }} />
      </div>
    </div>
  );
}