/**
 * OpenAI Realtime WebRTC client.
 *
 * Flow:
 *  1. Ask our server for an ephemeral token (`/api/realtime-token`).
 *  2. Create an RTCPeerConnection, attach the mic track, prepare a remote
 *     <audio> sink for the model's voice.
 *  3. Open a data channel (`oai-events`) that carries transcript / tool /
 *     control events as JSON.
 *  4. Do an SDP offer/answer directly with OpenAI, using the ephemeral token.
 *
 * Once connected, audio flows P2P — the server is out of the hot path, so
 * latency is on the order of 400-600 ms.
 */

export type RealtimeEvent =
  | { type: "connected" }
  | { type: "disconnected"; reason?: string }
  | { type: "user_transcript"; text: string; final: boolean }
  | { type: "assistant_transcript"; text: string; final: boolean }
  | { type: "error"; message: string };

export type RealtimeListener = (e: RealtimeEvent) => void;

const REALTIME_MODEL = "gpt-4o-realtime-preview";

export class RealtimeClient {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private micStream: MediaStream | null = null;
  private audioEl: HTMLAudioElement | null = null;
  private listeners = new Set<RealtimeListener>();
  private closed = false;

  // Cumulative transcript buffers (Realtime emits deltas).
  private userBuf = "";
  private asstBuf = "";

  on(l: RealtimeListener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  private emit(e: RealtimeEvent) {
    for (const l of this.listeners) {
      try {
        l(e);
      } catch (err) {
        console.error("[realtime] listener threw", err);
      }
    }
  }

  async connect(): Promise<void> {
    if (this.pc) return;

    // 1. Ephemeral token from our server.
    const tokRes = await fetch("/api/realtime-token", { method: "POST" });
    if (!tokRes.ok) {
      const txt = await tokRes.text().catch(() => "");
      throw new Error(txt || `Failed to mint realtime token (${tokRes.status})`);
    }
    const session = await tokRes.json();
    const ephemeralKey: string | undefined = session?.client_secret?.value;
    if (!ephemeralKey) throw new Error("Realtime session missing client_secret");

    // 2. Peer connection + remote audio sink.
    const pc = new RTCPeerConnection();
    this.pc = pc;

    this.audioEl = new Audio();
    this.audioEl.autoplay = true;
    pc.ontrack = (ev) => {
      if (this.audioEl) this.audioEl.srcObject = ev.streams[0];
    };

    pc.onconnectionstatechange = () => {
      if (!this.pc) return;
      const s = this.pc.connectionState;
      if (s === "failed" || s === "closed" || s === "disconnected") {
        this.emit({ type: "disconnected", reason: s });
      }
    };

    // 3. Mic input.
    const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.micStream = mic;
    for (const track of mic.getTracks()) pc.addTrack(track, mic);

    // 4. Event channel.
    const dc = pc.createDataChannel("oai-events");
    this.dc = dc;
    dc.onmessage = (ev) => this.handleServerEvent(ev.data);
    dc.onopen = () => this.emit({ type: "connected" });

    // 5. SDP handshake directly with OpenAI.
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const sdpRes = await fetch(
      `https://api.openai.com/v1/realtime?model=${encodeURIComponent(REALTIME_MODEL)}`,
      {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${ephemeralKey}`,
          "Content-Type": "application/sdp",
        },
      },
    );
    if (!sdpRes.ok) {
      const txt = await sdpRes.text().catch(() => "");
      throw new Error(txt || `Realtime SDP exchange failed (${sdpRes.status})`);
    }
    const answerSdp = await sdpRes.text();
    await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
  }

  private handleServerEvent(raw: string) {
    let evt: {
      type?: string;
      delta?: string;
      transcript?: string;
      error?: { message?: string };
    };
    try {
      evt = JSON.parse(raw);
    } catch {
      return;
    }
    if (!evt.type) return;

    switch (evt.type) {
      // User speech transcribed incrementally.
      case "conversation.item.input_audio_transcription.delta": {
        if (typeof evt.delta === "string") this.userBuf += evt.delta;
        this.emit({ type: "user_transcript", text: this.userBuf, final: false });
        break;
      }
      case "conversation.item.input_audio_transcription.completed": {
        const text = typeof evt.transcript === "string" ? evt.transcript : this.userBuf;
        this.emit({ type: "user_transcript", text, final: true });
        this.userBuf = "";
        break;
      }
      // Assistant reply streamed as text (audio is separate WebRTC track).
      case "response.audio_transcript.delta": {
        if (typeof evt.delta === "string") this.asstBuf += evt.delta;
        this.emit({ type: "assistant_transcript", text: this.asstBuf, final: false });
        break;
      }
      case "response.audio_transcript.done": {
        const text = typeof evt.transcript === "string" ? evt.transcript : this.asstBuf;
        this.emit({ type: "assistant_transcript", text, final: true });
        this.asstBuf = "";
        break;
      }
      case "error": {
        const msg = evt.error?.message || "Realtime error";
        this.emit({ type: "error", message: msg });
        break;
      }
    }
  }

  isConnected(): boolean {
    return !!this.dc && this.dc.readyState === "open";
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    try {
      this.dc?.close();
    } catch {
      /* ignore */
    }
    this.dc = null;
    try {
      this.pc?.close();
    } catch {
      /* ignore */
    }
    this.pc = null;
    if (this.micStream) {
      for (const t of this.micStream.getTracks()) {
        try {
          t.stop();
        } catch {
          /* ignore */
        }
      }
      this.micStream = null;
    }
    if (this.audioEl) {
      try {
        this.audioEl.pause();
        this.audioEl.srcObject = null;
      } catch {
        /* ignore */
      }
      this.audioEl = null;
    }
    this.emit({ type: "disconnected" });
  }
}
