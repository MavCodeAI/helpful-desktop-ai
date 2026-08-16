import { useCallback, useEffect, useRef, useState } from "react";
import {
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
import { getGeminiLiveToken } from "@/lib/gemini-live-token.functions";
import { classifyVoiceError, type VoiceErrorInfo } from "@/lib/voice-errors";
import type { LangCode } from "@/lib/persona";

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
  lang: LangCode;
  onFinalMessage: (m: VoiceMessage, ctx: { atBottom: boolean }) => void;
  onRateAdapt: (r: number) => void;
  onRequestKey: () => void;
};

export function useRealtimeSession(opts: Options) {
  const {
    provider, geminiKey, hfVoice, geminiVoice, pace, rate, sensitivity, autoRate,
    systemPrompt, lang,
    onFinalMessage, onRateAdapt, onRequestKey,
  } = opts;

  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [partial, setPartial] = useState<VoiceMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorInfo, setErrorInfo] = useState<VoiceErrorInfo | null>(null);
  const [cooldown, setCooldown] = useCooldownTimer();
  const [level, setLevel] = useState<number>(0);
  const [latency, setLatency] = useState<number | null>(null);
  const [sttLatency, setSttLatency] = useState<number | null>(null);
  const [ttsLatency, setTtsLatency] = useState<number | null>(null);
  const [micPermission, setMicPermission] = useMicPermission();
  const clearError = useCallback(() => {
    setError(null);
    setErrorInfo(null);
  }, []);
  const reportError = useCallback((raw: string, meta?: { retryAfterSec?: number }) => {
    const info = classifyVoiceError(raw, provider, meta);
    setError(info.message);
    setErrorInfo(info);
    setStatus("error");
    hapticError();
    if (info.retryAfterSec) setCooldown(info.retryAfterSec);
  }, [provider, setCooldown]);
  const micError = useCallback((message: string | null) => {
    if (message) reportError(message);
    else clearError();
  }, [clearError, reportError]);
  const { micTest, start: startMicTestMode, stop: stopMicTestMode } = useMicTest(setLevel, micError);

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
    clearError();
    setStatus("connecting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setMicPermission("granted");
    } catch (e: unknown) {
      const name = e instanceof Error ? e.name : "";
      setMicPermission(name === "NotAllowedError" ? "denied" : "prompt");
      reportError(
        name === "NotAllowedError"
          ? "Microphone blocked. Enable it in your browser settings and try again."
          : "Could not access microphone."
      );
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
        reportError(msg, meta);
      },
    };
    try {
      const voiceOpts = {
        voice: provider === "gemini" ? geminiVoice : hfVoice,
        pace,
        rate,
        sensitivity,
        systemPrompt,
        lang,
      };
      let geminiToken = geminiKey;
      if (provider === "gemini") {
        const tokenResult = await getGeminiLiveToken({ data: { userKey: geminiKey.trim() || undefined } });
        if (!tokenResult.configured) {
          reportError(tokenResult.error);
          onRequestKey();
          return;
        }
        geminiToken = tokenResult.token;
      }
      const ctrl =
        provider === "gemini"
          ? await startGemini(geminiToken, handlers, voiceOpts)
          : await startGemini(geminiToken, handlers, voiceOpts);
      controllerRef.current = ctrl;
    } catch (e: unknown) {
      reportError(e instanceof Error ? e.message : "Failed to start");
    }
  }, [provider, geminiKey, hfVoice, geminiVoice, pace, rate, sensitivity, systemPrompt, lang, micTest, stopMicTestMode, onRequestKey, clearError, reportError, setMicPermission]);

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
    status, partial, setPartial, error, errorInfo, setError, clearError, cooldown, setCooldown,
    level, latency, sttLatency, ttsLatency, micTest, micPermission,
    start, stop, startMicTestMode, stopMicTestMode,
    setLiveRate, setAtBottom,
  };
}