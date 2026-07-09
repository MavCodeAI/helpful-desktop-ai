/**
 * STT response reader — handles both streaming (SSE) and non-streaming (JSON)
 * responses from /api/stt uniformly, so the UI can wire deltas into a
 * partial-transcript state and commit the final text once.
 *
 * Extracted from the Jarvis route so it can be unit-tested without a DOM.
 */

export type STTEvent =
  | { type: "delta"; delta: string }
  | { type: "done"; text: string }
  | null;

/**
 * Parse a single SSE `data:` line into a normalized STT event.
 * Returns null for keepalives, `[DONE]`, malformed JSON, or unrelated frames.
 */
export function parseSseDataLine(raw: string): STTEvent {
  const l = raw.trim();
  if (!l.startsWith("data:")) return null;
  const data = l.slice(5).trim();
  if (!data || data === "[DONE]") return null;
  try {
    const evt = JSON.parse(data);
    if (evt.type === "transcript.text.delta" && typeof evt.delta === "string") {
      return { type: "delta", delta: evt.delta };
    }
    if (evt.type === "transcript.text.done" && typeof evt.text === "string") {
      return { type: "done", text: evt.text };
    }
  } catch {
    /* skip */
  }
  return null;
}

/**
 * Drain an SSE byte-stream reader, forwarding each accumulated delta to
 * `onDelta` and returning the final transcript text. If the stream never
 * emits a `done` event, the accumulated deltas are used as the final text.
 */
export async function consumeSttSseStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onDelta: (accumulated: string) => void,
): Promise<string> {
  const decoder = new TextDecoder();
  let buffer = "";
  let acc = "";
  let finalText = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const raw of lines) {
      const evt = parseSseDataLine(raw);
      if (!evt) continue;
      if (evt.type === "delta") {
        acc += evt.delta;
        onDelta(acc);
      } else if (evt.type === "done") {
        finalText = evt.text;
      }
    }
  }
  return finalText || acc;
}

/**
 * Unified STT response reader. Dispatches to the SSE parser when the
 * response advertises `text/event-stream`; otherwise falls back to a
 * plain-JSON `{ text }` body. Returns the final transcript (may be empty).
 */
export async function readSttResponse(
  res: Response,
  onDelta: (accumulated: string) => void,
): Promise<string> {
  const ctype = (res.headers.get("content-type") || "").toLowerCase();
  if (res.body && ctype.includes("text/event-stream")) {
    const reader = res.body.getReader();
    try {
      return await consumeSttSseStream(reader, onDelta);
    } finally {
      // Release the underlying socket even on mid-stream abort.
      reader.cancel().catch(() => {});
    }
  }
  const json = (await res.json().catch(() => ({}))) as { text?: string };
  return json.text || "";
}
