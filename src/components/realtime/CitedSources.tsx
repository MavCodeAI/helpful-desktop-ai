type Source = { number: string; title: string; url: string };

type Props = { sources: Source[] };

export function parseCitations(text: string): { body: string; sources: Source[] } {
  const marker = text.search(/\n\s*\*\*Sources:\*\*/i);
  if (marker < 0) return { body: text, sources: [] };

  const body = text.slice(0, marker).trim();
  const sourceBlock = text.slice(marker).replace(/^\n\s*\*\*Sources:\*\*\s*/i, "");
  const sources: Source[] = [];
  const pattern = /\[(\d+)\]\s*([^\n]+)\n(https?:\/\/\S+)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(sourceBlock)) && sources.length < 6) {
    sources.push({ number: match[1], title: match[2].trim(), url: match[3].trim() });
  }
  return { body, sources };
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "source";
  }
}

export function CitedSources({ sources }: Props) {
  if (!sources.length) return null;
  return (
    <div className="mt-2 grid gap-1.5 sm:grid-cols-2" aria-label="Cited sources">
      {sources.map((source) => (
        <a
          key={`${source.number}-${source.url}`}
          href={source.url}
          target="_blank"
          rel="noreferrer"
          className="group rounded-xl border border-cyan-300/15 bg-cyan-300/[0.04] px-3 py-2 transition hover:border-cyan-300/35 hover:bg-cyan-300/[0.08]"
        >
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-cyan-200/60">
            <span className="grid h-4 w-4 place-items-center rounded-full bg-cyan-300/15 text-cyan-100">{source.number}</span>
            <span>{hostOf(source.url)}</span>
          </div>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-white/75 group-hover:text-white">{source.title}</p>
        </a>
      ))}
    </div>
  );
}
