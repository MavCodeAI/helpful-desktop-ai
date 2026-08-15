import { GEMINI_LIVE_MODEL_PATH } from "./gemini-live-config";

// Voice provider adapters — HF Space (S2S) & Google Gemini Live.
// Each provider exposes: start({ onStatus, onMessage, onError }) => Controller

export type ProviderId = "hf" | "gemini";

export type VoiceStatus =
  | "connecting"
  | "listening"
  | "speaking"
  | "idle"
  | "error";

export type VoiceMessage = { role: "you" | "assistant"; text: string };

export interface Handlers {
  onStatus: (s: VoiceStatus) => void;
  onMessage: (m: VoiceMessage) => void;
  onPartial?: (role: "you" | "assistant", text: string) => void;
  onError: (msg: string, meta?: { retryAfterSec?: number }) => void;
  /** Input mic level (RMS 0..1), emitted while listening. */
  onLevel?: (rms: number) => void;
  /** Total response latency in ms: last non-silent input frame → first assistant audio. */
  onLatency?: (ms: number) => void;
  /** STT processing latency: last input speech → first user transcript from provider. */
  onSttLatency?: (ms: number) => void;
  /** TTS playback latency: first user transcript → first assistant audio frame. */
  onTtsLatency?: (ms: number) => void;
}

export type Pace = "slow" | "natural" | "brisk";

export interface VoiceOptions {
  voice?: string;
  pace?: Pace;
  /** Output playback rate 0.5–2.0. */
  rate?: number;
  /** Mic sensitivity multiplier 0.3–3.0. Higher = pick up quieter voice. */
  sensitivity?: number;
  /** Full persona/language/memory system prompt (built by src/lib/persona.ts). */
  systemPrompt?: string;
}

export const HF_VOICES = ["alloy", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse"] as const;
export const GEMINI_VOICES = ["Puck", "Charon", "Kore", "Fenrir", "Aoede", "Leda", "Orus", "Zephyr"] as const;

function paceInstruction(pace: Pace | undefined): string {
  switch (pace) {
    case "slow": return "Speak slowly and warmly, with natural pauses between phrases.";
    case "brisk": return "Speak at a brisk, energetic pace.";
    default: return "Speak at a natural, conversational pace.";
  }
}

function buildInstructions(opts?: VoiceOptions): string {
  const base = opts?.systemPrompt?.trim() || "You are Alpha, a friendly, concise voice assistant.";
  return `${base}\n\n${paceInstruction(opts?.pace)}\n\nThe user may interrupt you at any time — stop speaking immediately when they start.`;
}

export interface Controller {
  stop: () => void;
  setRate?: (rate: number) => void;
}

/** Mic-test only: opens the mic, emits RMS levels, sends audio nowhere. */
export async function startMicTest(onLevel: (rms: number) => void): Promise<Controller> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(stream);
  const proc = ctx.createScriptProcessor(LOW_LAT_BUF, 1, 1);
  let lastEmit = 0;
  proc.onaudioprocess = (e) => {
    const data = e.inputBuffer.getChannelData(0);
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
    const rms = Math.sqrt(sum / data.length);
    const now = performance.now();
    if (now - lastEmit > LEVEL_THROTTLE_MS) { onLevel(rms); lastEmit = now; }
  };
  source.connect(proc);
  proc.connect(ctx.destination);
  return {
    stop: () => {
      try { proc.disconnect(); source.disconnect(); } catch {}
      stream.getTracks().forEach((t) => t.stop());
      ctx.close().catch(() => {});
      onLevel(0);
    },
  };
}

function b64FromBuf(buf: ArrayBufferLike) {
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(bin);
}
function b64ToBytes(b64: string) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function floatToPCM16(input: Float32Array) {
  const pcm = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return pcm;
}

/** Player queues raw PCM16 chunks at the given sample rate. */
function makePlayer(
  sampleRate: number,
  onSpeaking: (v: boolean) => void,
  initialRate = 1,
) {
  const ctx = new AudioContext({ sampleRate });
  let playTime = 0;
  let active = 0;
  let rate = Math.max(0.5, Math.min(2, initialRate));
  return {
    ctx,
    setRate(r: number) { rate = Math.max(0.5, Math.min(2, r)); },
    play(bytes: Uint8Array) {
      const int16 = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
      const f32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) f32[i] = int16[i] / 32768;
      const buf = ctx.createBuffer(1, f32.length, sampleRate);
      buf.copyToChannel(f32, 0);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = rate;
      src.connect(ctx.destination);
      const startAt = Math.max(ctx.currentTime, playTime);
      src.start(startAt);
      playTime = startAt + buf.duration / rate;
      active++;
      onSpeaking(true);
      src.onended = () => {
        active--;
        if (active <= 0) onSpeaking(false);
      };
    },
    close() { ctx.close().catch(() => {}); },
  };
}

// Low-latency script processor buffer. 512 samples ≈ 21ms @ 24kHz / 32ms @ 16kHz.
// The old 2048 added ~85ms of input jitter buffering before the network hop.
const LOW_LAT_BUF = 512;
const LEVEL_THROTTLE_MS = 40;
const CONNECT_TIMEOUT_MS = 12_000;
const INPUT_ACTIVITY_BASE_RMS = 0.012;
function activityThreshold(sensitivity?: number) {
  const s = Math.max(0.3, Math.min(3, sensitivity ?? 1));
  return INPUT_ACTIVITY_BASE_RMS / s;
}

// ────────────────────────────────────────────────────────────────────────
// HF Space provider (OpenAI Realtime protocol via smolagents Space)
// ────────────────────────────────────────────────────────────────────────
const HF_SESSION_URL = "https://smolagents-hf-realtime-voice.hf.space/api/session";
const HF_SR = 24000;

export async function startHF(h: Handlers, opts?: VoiceOptions): Promise<Controller> {
  h.onStatus("connecting");
  const res = await fetch(HF_SESSION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (res.status === 402) {
    const body = await res.json().catch(() => ({} as { remainingSec?: number }));
    const wait = Math.max(30, Math.ceil(Number(body.remainingSec) || 60));
    h.onError("HF free anon quota exhausted.", { retryAfterSec: wait });
    return { stop: () => {} };
  }
  if (!res.ok) {
    if (res.status === 401) {
      h.onError("HF session failed: 401 Unauthorized. This Hugging Face Space requires a Hugging Face login session.");
    } else {
      h.onError(`HF session failed: ${res.status}`);
    }
    return { stop: () => {} };
  }
  const session = await res.json();
  if (session.state === "queued") { h.onError(`Queued — position ${session.position}.`); return { stop: () => {} }; }
  const connectUrl: string = session.connect_url;

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  const inCtx = new AudioContext({ sampleRate: HF_SR });
  let speaking = false;
  const player = makePlayer(HF_SR, (v) => { speaking = v; h.onStatus(v ? "speaking" : "listening"); }, opts?.rate ?? 1);
  const ws = new WebSocket(connectUrl);
  let connected = false;
  let closedLocally = false;
  const connectTimeout = window.setTimeout(() => {
    if (connected) return;
    cleanup();
    h.onError("Voice connection timed out. Check your internet connection and try again.");
  }, CONNECT_TIMEOUT_MS);
  let lastInputActivity = 0;
  let awaitingReply = false;
  let lastLevelEmit = 0;
  let sttFirstAt = 0;
  const activityRms = activityThreshold(opts?.sensitivity);

  const cleanup = () => {
    closedLocally = true;
    try { ws.close(); } catch {}
    stream.getTracks().forEach((t) => t.stop());
    inCtx.close().catch(() => {});
    player.close();
    h.onLevel?.(0);
    window.clearTimeout(connectTimeout);
  };

  const stop = () => {
    cleanup();
    h.onStatus("idle");
  };

  ws.onopen = () => {
    connected = true;
    window.clearTimeout(connectTimeout);
    h.onStatus("listening");
    ws.send(JSON.stringify({
      type: "session.update",
      session: {
        type: "realtime",
        instructions: buildInstructions(opts),
        voice: opts?.voice || "alloy",
      },
    }));
    const source = inCtx.createMediaStreamSource(stream);
    const proc = inCtx.createScriptProcessor(LOW_LAT_BUF, 1, 1);
    proc.onaudioprocess = (e) => {
      if (ws.readyState !== WebSocket.OPEN || speaking) return;
      const data = e.inputBuffer.getChannelData(0);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
      const rms = Math.sqrt(sum / data.length);
      const now = performance.now();
      if (now - lastLevelEmit > LEVEL_THROTTLE_MS) {
        h.onLevel?.(rms);
        lastLevelEmit = now;
      }
      if (rms > activityRms) {
        lastInputActivity = now;
        awaitingReply = true;
        sttFirstAt = 0;
      }
      const pcm = floatToPCM16(data);
      ws.send(JSON.stringify({ type: "input_audio_buffer.append", audio: b64FromBuf(pcm.buffer) }));
    };
    source.connect(proc);
    proc.connect(inCtx.destination);
  };
  const hfBuf = { you: "", assistant: "" };
  ws.onmessage = (ev) => {
    if (typeof ev.data !== "string") return;
    let msg: { type?: string; delta?: string; transcript?: string };
    try { msg = JSON.parse(ev.data); } catch { return; }
    switch (msg.type) {
      case "response.audio.delta":
      case "response.output_audio.delta":
        if (msg.delta) {
          if (awaitingReply && lastInputActivity) {
            const now2 = performance.now();
            h.onLatency?.(Math.round(now2 - lastInputActivity));
            if (sttFirstAt) h.onTtsLatency?.(Math.round(now2 - sttFirstAt));
            awaitingReply = false;
          }
          player.play(b64ToBytes(msg.delta));
        }
        break;
      case "response.audio_transcript.delta":
      case "response.output_audio_transcript.delta":
        if (msg.delta) { hfBuf.assistant += msg.delta; h.onPartial?.("assistant", hfBuf.assistant); }
        break;
      case "response.audio_transcript.done":
      case "response.output_audio_transcript.done":
        if (msg.transcript) h.onMessage({ role: "assistant", text: msg.transcript });
        hfBuf.assistant = "";
        break;
      case "conversation.item.input_audio_transcription.delta":
        if (msg.delta) {
          if (!sttFirstAt && lastInputActivity) {
            sttFirstAt = performance.now();
            h.onSttLatency?.(Math.round(sttFirstAt - lastInputActivity));
          }
          hfBuf.you += msg.delta;
          h.onPartial?.("you", hfBuf.you);
        }
        break;
      case "conversation.item.input_audio_transcription.completed":
        if (msg.transcript) h.onMessage({ role: "you", text: msg.transcript });
        hfBuf.you = "";
        break;
      case "error":
        h.onError(JSON.stringify(msg));
        break;
    }
  };
  ws.onerror = () => {
    cleanup();
    h.onError("Voice WebSocket connection failed. Check your internet connection and try again.");
  };
  ws.onclose = () => {
    if (closedLocally) return;
    if (!connected) h.onError("Voice service did not accept the connection. Try Gemini or retry in a minute.");
  };
  return { stop, setRate: (r) => player.setRate(r) };
}

// ────────────────────────────────────────────────────────────────────────
// Gemini Live provider (BidiGenerateContent WebSocket)
// Production uses a short-lived server-issued ephemeral token. The long-lived
// GEMINI_API_KEY never enters the browser or Android WebView.
// ────────────────────────────────────────────────────────────────────────
const GEMINI_IN_SR = 16000;
const GEMINI_OUT_SR = 24000;

export async function startGemini(accessToken: string, h: Handlers, opts?: VoiceOptions): Promise<Controller> {
  const trimmedToken = accessToken.trim();
  if (!trimmedToken) {
    h.onError("Gemini Live session token missing. Configure GEMINI_API_KEY on the server.");
    return { stop: () => {} };
  }
  h.onStatus("connecting");

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  const inCtx = new AudioContext({ sampleRate: GEMINI_IN_SR });
  let speaking = false;
  const player = makePlayer(GEMINI_OUT_SR, (v) => { speaking = v; h.onStatus(v ? "speaking" : "listening"); }, opts?.rate ?? 1);

  const url =
    `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(trimmedToken)}`;
  const ws = new WebSocket(url);
  let connected = false;
  let closedByUser = false;
  const connectTimeout = window.setTimeout(() => {
    if (connected) return;
    cleanup();
    h.onError("Gemini connection timed out. Check internet/VPN, then try again.");
  }, CONNECT_TIMEOUT_MS);
  let lastInputActivity = 0;
  let awaitingReply = false;
  let lastLevelEmit = 0;
  let sttFirstAt = 0;
  const activityRms = activityThreshold(opts?.sensitivity);

  const cleanup = () => {
    closedByUser = true;
    try { ws.close(); } catch {}
    stream.getTracks().forEach((t) => t.stop());
    inCtx.close().catch(() => {});
    player.close();
    h.onLevel?.(0);
    window.clearTimeout(connectTimeout);
  };

  const stop = () => {
    cleanup();
    h.onStatus("idle");
  };

  ws.onopen = () => {
    ws.send(JSON.stringify({
      setup: {
        model: GEMINI_LIVE_MODEL_PATH,
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: opts?.voice || "Aoede" },
            },
          },
        },
        systemInstruction: { parts: [{ text: buildInstructions(opts) }] },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
      },
    }));
  };

  const partialBuf = { you: "", assistant: "" };

  ws.onmessage = async (ev) => {
    const raw = ev.data instanceof Blob ? await ev.data.text() : typeof ev.data === "string" ? ev.data : "";
    if (!raw) return;
    let msg: {
      setupComplete?: unknown;
      serverContent?: {
        modelTurn?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string }; text?: string }> };
        inputTranscription?: { text?: string; finished?: boolean };
        outputTranscription?: { text?: string; finished?: boolean };
        turnComplete?: boolean;
        interrupted?: boolean;
      };
    };
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.setupComplete !== undefined) {
      connected = true;
      window.clearTimeout(connectTimeout);
      h.onStatus("listening");
      const source = inCtx.createMediaStreamSource(stream);
      const proc = inCtx.createScriptProcessor(LOW_LAT_BUF, 1, 1);
      proc.onaudioprocess = (e) => {
        if (ws.readyState !== WebSocket.OPEN || speaking) return;
        const data = e.inputBuffer.getChannelData(0);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
        const rms = Math.sqrt(sum / data.length);
        const now = performance.now();
        if (now - lastLevelEmit > LEVEL_THROTTLE_MS) {
          h.onLevel?.(rms);
          lastLevelEmit = now;
        }
        if (rms > activityRms) {
          lastInputActivity = now;
          awaitingReply = true;
          sttFirstAt = 0;
        }
        const pcm = floatToPCM16(data);
        ws.send(JSON.stringify({
          realtimeInput: {
            audio: { mimeType: `audio/pcm;rate=${GEMINI_IN_SR}`, data: b64FromBuf(pcm.buffer) },
          },
        }));
      };
      source.connect(proc);
      proc.connect(inCtx.destination);
      return;
    }

    const sc = msg.serverContent;
    if (sc?.inputTranscription?.text) {
      if (!sttFirstAt && lastInputActivity) {
        sttFirstAt = performance.now();
        h.onSttLatency?.(Math.round(sttFirstAt - lastInputActivity));
      }
      partialBuf.you += sc.inputTranscription.text;
      h.onPartial?.("you", partialBuf.you);
    }
    if (sc?.outputTranscription?.text) {
      partialBuf.assistant += sc.outputTranscription.text;
      h.onPartial?.("assistant", partialBuf.assistant);
    }

    const parts = sc?.modelTurn?.parts ?? [];
    for (const p of parts) {
      if (p.inlineData?.data && p.inlineData.mimeType?.startsWith("audio/")) {
        if (awaitingReply && lastInputActivity) {
          const now2 = performance.now();
          h.onLatency?.(Math.round(now2 - lastInputActivity));
          if (sttFirstAt) h.onTtsLatency?.(Math.round(now2 - sttFirstAt));
          awaitingReply = false;
        }
        player.play(b64ToBytes(p.inlineData.data));
      } else if (p.text) {
        h.onMessage({ role: "assistant", text: p.text });
      }
    }

    if (sc?.turnComplete) {
      if (partialBuf.you.trim()) h.onMessage({ role: "you", text: partialBuf.you.trim() });
      if (partialBuf.assistant.trim()) h.onMessage({ role: "assistant", text: partialBuf.assistant.trim() });
      partialBuf.you = "";
      partialBuf.assistant = "";
    }
  };

  ws.onerror = () => {
    // The following close event carries the useful WebSocket close code/reason.
    // Do not clean up here, otherwise the browser can suppress that diagnostic.
  };
  ws.onclose = (ev) => {
    if (closedByUser) return;
    cleanup();
    if (ev.code === 1007) {
      h.onError("Gemini Live setup rejected (1007: invalid frame payload). Check the Live model and setup protocol.");
      return;
    }
    if (ev.code === 1008 || ev.code === 4001 || ev.code === 4003) {
      h.onError(`Gemini auth failed (${ev.code}). The server-issued session token was rejected.`);
      return;
    }
    if (!connected) h.onError(`Gemini did not connect (${ev.code || "closed"}). ${ev.reason || "Check server configuration and internet, then try again."}`);
  };
  return { stop, setRate: (r) => player.setRate(r) };
}
