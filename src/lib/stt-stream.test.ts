import { describe, expect, it, vi } from "vitest";
import {
  consumeSttSseStream,
  parseSseDataLine,
  readSttResponse,
} from "./stt-stream";

/** Build a ReadableStream<Uint8Array> from a list of chunks (as strings). */
function streamFromChunks(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(encoder.encode(chunks[i++]));
      } else {
        controller.close();
      }
    },
  });
}

/** SSE data-line helper. */
const sse = (obj: unknown) => `data: ${JSON.stringify(obj)}\n`;

describe("parseSseDataLine", () => {
  it("parses a transcript.text.delta event", () => {
    expect(parseSseDataLine(sse({ type: "transcript.text.delta", delta: "Hi" })))
      .toEqual({ type: "delta", delta: "Hi" });
  });

  it("parses a transcript.text.done event", () => {
    expect(parseSseDataLine(sse({ type: "transcript.text.done", text: "Hello world" })))
      .toEqual({ type: "done", text: "Hello world" });
  });

  it("ignores non-data lines, keepalives, [DONE], and malformed frames", () => {
    expect(parseSseDataLine(": keepalive\n")).toBeNull();
    expect(parseSseDataLine("event: ping\n")).toBeNull();
    expect(parseSseDataLine("data: [DONE]")).toBeNull();
    expect(parseSseDataLine("data: {not json")).toBeNull();
    expect(parseSseDataLine("data: {\"type\":\"other\"}")).toBeNull();
    // Wrong field shape (missing delta) should be ignored, not thrown.
    expect(parseSseDataLine(sse({ type: "transcript.text.delta" }))).toBeNull();
  });
});

describe("consumeSttSseStream — delta handling + final commit", () => {
  it("accumulates deltas monotonically and returns done.text as final", async () => {
    const stream = streamFromChunks([
      sse({ type: "transcript.text.delta", delta: "Hello" }),
      sse({ type: "transcript.text.delta", delta: " world" }),
      sse({ type: "transcript.text.done", text: "Hello world." }),
    ]);
    const onDelta = vi.fn();

    const final = await consumeSttSseStream(stream.getReader(), onDelta);

    // Each delta forwards the ACCUMULATED text so the UI can set the
    // partial-transcript state directly without re-concatenating.
    expect(onDelta.mock.calls.map((c) => c[0])).toEqual(["Hello", "Hello world"]);
    // Final text is the server-provided canonical form, not the raw sum.
    expect(final).toBe("Hello world.");
  });

  it("handles SSE frames split across arbitrary chunk boundaries", async () => {
    // Split mid-JSON-string, mid-line, and after a complete line.
    const stream = streamFromChunks([
      'data: {"type":"transcript.text.del',
      'ta","delta":"foo"}\ndata: {"type":"transcript.text.delta","del',
      'ta":"bar"}\n',
      sse({ type: "transcript.text.done", text: "foobar" }),
    ]);
    const onDelta = vi.fn();

    const final = await consumeSttSseStream(stream.getReader(), onDelta);

    expect(onDelta.mock.calls.map((c) => c[0])).toEqual(["foo", "foobar"]);
    expect(final).toBe("foobar");
  });

  it("falls back to the accumulated deltas when no done event arrives", async () => {
    const stream = streamFromChunks([
      sse({ type: "transcript.text.delta", delta: "a" }),
      sse({ type: "transcript.text.delta", delta: "b" }),
      ": keepalive\n",
    ]);
    const onDelta = vi.fn();

    const final = await consumeSttSseStream(stream.getReader(), onDelta);
    expect(final).toBe("ab");
    expect(onDelta).toHaveBeenCalledTimes(2);
  });

  it("returns empty string and never calls onDelta for an empty stream", async () => {
    const stream = streamFromChunks([]);
    const onDelta = vi.fn();
    const final = await consumeSttSseStream(stream.getReader(), onDelta);
    expect(final).toBe("");
    expect(onDelta).not.toHaveBeenCalled();
  });
});

describe("readSttResponse — streaming vs non-streaming dispatch", () => {
  it("routes SSE responses through the stream parser", async () => {
    const body = streamFromChunks([
      sse({ type: "transcript.text.delta", delta: "Hey" }),
      sse({ type: "transcript.text.done", text: "Hey there" }),
    ]);
    const res = new Response(body, {
      headers: { "content-type": "text/event-stream" },
    });
    const onDelta = vi.fn();

    const final = await readSttResponse(res, onDelta);

    expect(onDelta).toHaveBeenCalledWith("Hey");
    expect(final).toBe("Hey there");
  });

  it("reads JSON body for non-streaming responses and never calls onDelta", async () => {
    const res = new Response(JSON.stringify({ text: "Plain response" }), {
      headers: { "content-type": "application/json" },
    });
    const onDelta = vi.fn();

    const final = await readSttResponse(res, onDelta);

    expect(final).toBe("Plain response");
    expect(onDelta).not.toHaveBeenCalled();
  });

  it("returns empty string for malformed JSON bodies (no throw)", async () => {
    const res = new Response("not json at all", {
      headers: { "content-type": "application/json" },
    });
    const onDelta = vi.fn();

    const final = await readSttResponse(res, onDelta);
    expect(final).toBe("");
    expect(onDelta).not.toHaveBeenCalled();
  });

  it("returns empty string when JSON body omits `text`", async () => {
    const res = new Response(JSON.stringify({ other: "field" }), {
      headers: { "content-type": "application/json" },
    });
    const final = await readSttResponse(res, vi.fn());
    expect(final).toBe("");
  });
});
