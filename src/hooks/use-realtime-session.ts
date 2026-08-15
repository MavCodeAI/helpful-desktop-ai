import { useCallback, useEffect, useRef, useState } from "react";
import {
  startHF,
  startGemini,
  type Controller,
  type ProviderId,
  type VoiceMessage,
  type VoiceStatus,
  type Pace,
} from "@/lib/voice-providers";
import { useMicPermission, type MicPermission } from "./use-mic-permission";
import { useCooldownTimer } from "./use-cooldown-timer";
import { useMicTest } from "./use-mic-test";
import { hapticError, hapticLight } from "@/lib/capacitor-native";

export type { MicPermission };

type Options = {
  provider: ProviderId;
  geminiKey: string;
  hfVoice: string;
  geminiVoice: string;
  pace: Pace;
  rate: number;
  sensitivity: number;
  autoRate: boolean;
  systemPrompt?: string;
  onFinalMessage: (m: VoiceMessage, ctx: { atBottom: boolean }) => void;
  onRateAdapt: (r: number) => void;
  onRequestKey: () => void;
};

export function useRealtimeSession(opts: Options) {
  const {
    provider, geminiKey, hfVoice, geminiVoice, pace, rate, sensitivity, autoRate,
    systemPrompt,
    onFinalMessage, onRateAdapt, onRequestKey,
  } = opts;

  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [partial, setPartial] = useState<VoiceMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useCooldownTimer();
  const [level, setLevel] = useState<number>(0);
  const [latency, setLatency] = useState<number | null>(null);
  const [sttLatency, setSttLatency] = useState<number | null>(null);
  const [ttsLatency, setTtsLatency] = useState<number | null>(null);
  const [micPermission, setMicPermission] = useMicPermission();
  const { micTest, start: startMicTestMode, stop: stopMicTestMode } = useMicTest(setLevel, setError);

  const controllerRef = useRef<Controller | null>(null);
  const latencyEmaRef = useRef<number | null>(null);
  const autoRateRef = useRef(false);
  const atBottomRef = useRef(true);
  const onFinalRef = useRef(onFinalMessage);
  const onRateAdaptRef = useRef(onRateAdapt);

  useEffect(() => { autoRateRef.current = autoRate; }, [autoRate]);
  useEffect(() => { onFinalRef.current = onFinalMessage; }, [onFinalMessage]);
  useEffect(() => { onRateAdaptRef.current = onRateAdapt; }, [onRateAdapt]);

  const stop = useCallback(() => {
    controllerRef.current?.stop();
    hapticLight();
    controllerRef.current = null;
    setStatus("idle");
    setPartial(null);
    setLevel(0);
    latencyEmaRef.current = null;
  }, []);

  const start = useCallback(async () => {
    hapticLight();
    if (micTest) stopMicTestMode();
    if (provider === "gemini" && !geminiKey) {
      setError("Gemini key not configured on server. Ask admin to set GEMINI_API_KEY.");
      setStatus("error");
      hapticError();
      onRequestKey();
      return;
    }
    setError(null);
    setStatus("connecting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setMicPermission("granted");
    } catch (e: unknown) {
      const name = e instanceof Error ? e.name : "";
      setMicPermission(name === "NotAllowedError" ? "denied" : "prompt");
      setError(
        name === "NotAllowedError"
          ? "Microphone blocked. Enable it in your browser settings and try again."
          : "Could not access microphone."
      );
      setStatus("error");
      hapticError();
      return;
    }
    const handlers = {
      onStatus: (s: VoiceStatus) => setStatus(s),
      onMessage: (m: VoiceMessage) => {
        setPartial(null);
        onFinalRef.current(m, { atBottom: atBottomRef.current });
      },
      onPartial: (role: "you" | "assistant", text: string) => setPartial({ role, text }),
      onLevel: (rms: number) => setLevel(rms),
      onLatency: (ms: number) => {
        setLatency(ms);
        const prev = latencyEmaRef.current;
        const ema = prev == null ? ms : prev * 0.7 + ms * 0.3;
        latencyEmaRef.current = ema;
        if (autoRateRef.current && controllerRef.current?.setRate) {
          const target =
            ema < 900 ? 1.0 :
            ema < 1500 ? 1.1 :
            ema < 2500 ? 1.2 : 1.3;
          controllerRef.current.setRate(target);
          onRateAdaptRef.current(target);
        }
      },
      onSttLatency: (ms: number) => setSttLatency(ms),
      onTtsLatency: (ms: number) => setTtsLatency(ms),
      onError: (msg: string, meta?: { retryAfterSec?: number }) => {
        setError(msg);
        setStatus("error");
        hapticError();
        if (meta?.retryAfterSec) setCooldown(meta.retryAfterSec);
      },
    };
    try {
      const voiceOpts = {
        voice: provider === "gemini" ? geminiVoice : hfVoice,
        pace,
        rate,
        sensitivity,
        systemPrompt,
      };
      const ctrl =
        provider === "gemini"
          ? await startGemini(geminiKey, handlers, voiceOpts)
          : await startHF(handlers, voiceOpts);
      controllerRef.current = ctrl;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to start");
      setStatus("error");
      hapticError();
    }
  }, [provider, geminiKey, hfVoice, geminiVoice, pace, rate, sensitivity, systemPrompt, micTest, stopMicTestMode, onRequestKey]);

  // Cleanup on unmount
  useEffect(() => () => {
    controllerRef.current?.stop();
  }, []);

  // Apply live rate to the running session
  const setLiveRate = useCallback((r: number) => {
    controllerRef.current?.setRate?.(r);
  }, []);

  // Let the parent update atBottom for unread accounting
  const setAtBottom = useCallback((v: boolean) => { atBottomRef.current = v; }, []);

  return {
    status, partial, setPartial, error, setError, cooldown, setCooldown,
    level, latency, sttLatency, ttsLatency, micTest, micPermission,
    start, stop, startMicTestMode, stopMicTestMode,
    setLiveRate, setAtBottom,
  };
}