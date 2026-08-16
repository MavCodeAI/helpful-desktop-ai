export type Source = { number: string; title: string; url: string };

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
