import { useEffect, useRef, useState } from "react";
import { loadHotkey, loadWakePhrases, type HotkeyCombo } from "@/lib/realtime/constants";

type Options = {
  enableClap: boolean;
  enableWakeWord: boolean;
  enableHotkey: boolean;
  active: boolean;
  disabled: boolean;
  /** STT locale for the wake-word recognizer (e.g. "en-US", "ur-PK", "ar-SA"). */
  wakeLang?: string;
  onTrigger: () => void;
};

/**
 * Composite wake-trigger hook.
 *
 * - **Hotkey**: cheap `keydown` listener. Ctrl+Shift+A (also Meta+Shift+A on macOS).
 * - **Clap**: opens its own mic stream; detects two broadband RMS spikes
 *   within 1.5 s. Auto-tears down when disabled or when session goes active
 *   (to hand the mic back to the realtime session).
 * - **Wake word**: browser `webkitSpeechRecognition` in continuous mode.
 *   No cost, on-device on Chrome/Edge. Silently no-ops on Firefox/Safari.
 *
 * All three suppress themselves when `active` or `disabled` is true, so the
 * running session owns the mic exclusively.
 */
export function useWakeTriggers({
  enableClap, enableWakeWord, enableHotkey, active, disabled, wakeLang, onTrigger,
}: Options) {
  const onTriggerRef = useRef(onTrigger);
  useEffect(() => { onTriggerRef.current = onTrigger; }, [onTrigger]);

  const fire = () => {
    if (active || disabled) return;
    onTriggerRef.current();
  };

  // ── Hotkey ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!enableHotkey) return;
    const handler = (e: KeyboardEvent) => {
      const combo = (e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "a";
      if (!combo) return;
      // Don't hijack when user is typing in an input/textarea/contenteditable
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      e.preventDefault();
      fire();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enableHotkey, active, disabled]);

  // ── Clap detection ────────────────────────────────────────────────
  useEffect(() => {
    if (!enableClap || active || disabled) return;
    let cancelled = false;
    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;
    let raf = 0;
    let lastClapAt = 0;
    let lastEnergy = 0;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        ctx = new AC();
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        src.connect(analyser);
        const timeData = new Uint8Array(analyser.fftSize);
        const freqData = new Uint8Array(analyser.frequencyBinCount);

        const tick = () => {
          if (cancelled) return;
          analyser.getByteTimeDomainData(timeData);
          analyser.getByteFrequencyData(freqData);

          // RMS from time domain
          let sum = 0;
          for (let i = 0; i < timeData.length; i++) {
            const v = (timeData[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / timeData.length);

          // High-frequency energy ratio (claps are broadband, voice is bass-heavy)
          const half = freqData.length >> 1;
          let low = 0, high = 0;
          for (let i = 0; i < half; i++) low += freqData[i];
          for (let i = half; i < freqData.length; i++) high += freqData[i];
          const hfRatio = high / (low + high + 1);

          const isSpike = rms > 0.28 && hfRatio > 0.35 && rms - lastEnergy > 0.15;
          lastEnergy = rms;

          if (isSpike) {
            const now = performance.now();
            if (now - lastClapAt > 120 && now - lastClapAt < 1500) {
              // Second clap in window → fire
              lastClapAt = 0;
              fire();
            } else {
              lastClapAt = now;
            }
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch {
        // Mic denied or unavailable — silently disable
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      ctx?.close().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enableClap, active, disabled]);

  // ── Wake word (webkitSpeechRecognition) ───────────────────────────
  useEffect(() => {
    if (!enableWakeWord || active || disabled) return;
    type SR = typeof window & {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const w = window as SR;
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return; // Firefox/Safari — silently unsupported

    let rec: SpeechRecognitionLike | null = new Ctor();
    let stopped = false;
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = wakeLang || "en-US";

    rec.onresult = (ev: SpeechRecognitionResultEventLike) => {
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const transcript = ev.results[i][0]?.transcript?.toLowerCase() ?? "";
        if (WAKE_PHRASES.some((p) => transcript.includes(p))) {
          fire();
          break;
        }
      }
    };
    rec.onerror = () => { /* swallow — no-speech, aborted, network */ };
    rec.onend = () => {
      // Auto-restart if we didn't stop deliberately
      if (!stopped && rec) {
        try { rec.start(); } catch { /* already started */ }
      }
    };
    try { rec.start(); } catch { /* already started */ }

    return () => {
      stopped = true;
      try { rec?.stop(); } catch { /* ignore */ }
      rec = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enableWakeWord, active, disabled, wakeLang]);
}

// ── Minimal ambient types (SpeechRecognition isn't in lib.dom for TS) ──
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((ev: SpeechRecognitionResultEventLike) => void) | null;
  onerror: ((ev: unknown) => void) | null;
  onend: (() => void) | null;
}
interface SpeechRecognitionResultEventLike {
  resultIndex: number;
  results: { [index: number]: { [index: number]: { transcript: string } }; length: number };
}
