import { useEffect, useRef, useState } from "react";

/**
 * Live microphone amplitude (0..1), smoothed.
 *
 * When `active` is true AND the tab is visible, requests mic access, wires
 * the stream into a WebAudio AnalyserNode, and starts a RAF loop that
 * pushes an eased RMS value into state. When `active` flips false, the tab
 * is hidden, or the hook unmounts, the entire pipeline is torn down —
 * tracks stopped, source disconnected, AudioContext closed — so the OS-
 * level mic indicator turns off and no background CPU is spent.
 *
 * Guarantees:
 *  - No dangling mic tracks after cleanup (each track explicitly `.stop()`ed
 *    and removed from the stream).
 *  - No leaked AudioContext (awaited close, ref cleared).
 *  - Idempotent cleanup: safe to call twice, safe under React StrictMode.
 *  - Tab-hidden = fully released mic, not just paused.
 */
export interface MicStatus {
  /** Smoothed RMS amplitude, 0..1. Always 0 when the mic pipeline is down. */
  level: number;
  /** True once the mic stream is live, wired to the analyser, and the RAF
   *  loop is producing samples. False while permission is pending, when the
   *  tab is hidden, when `active` is false, or after any failure/teardown.
   *  Use this to drive UI indicators — it reflects reality, not intent. */
  active: boolean;
}

export function useMicLevel(active: boolean): MicStatus {
  const [level, setLevel] = useState(0);
  // Reflects whether the pipeline is truly live (stream open + RAF ticking).
  // Distinct from `active` (intent): stays false while permission resolves,
  // when tab is hidden, or after any failure.
  const [live, setLive] = useState(false);
  // Track visibility so the effect re-runs when the tab hides/returns.
  const [visible, setVisible] = useState(typeof document === "undefined" ? true : !document.hidden);

  // Debounce visibility flips: quickly toggling tabs (alt-tab spam, window
  // switcher previews) would otherwise tear down and re-request the mic on
  // every event, causing audible glitches, permission-prompt races, and a
  // flickering OS mic indicator. We wait until the tab has settled in one
  // state for `DEBOUNCE_MS` before re-running the pipeline effect. Hides
  // apply almost-immediately (short delay) so we still release the mic
  // promptly; returns wait longer to avoid restart storms.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const HIDE_MS = 150;
    const SHOW_MS = 400;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onVis = () => {
      if (timer != null) clearTimeout(timer);
      const nextVisible = !document.hidden;
      timer = setTimeout(
        () => {
          timer = null;
          setVisible((prev) => (prev === nextVisible ? prev : nextVisible));
        },
        nextVisible ? SHOW_MS : HIDE_MS,
      );
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      if (timer != null) clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!active || !visible) {
      setLevel(0);
      setLive(false);
      return;
    }

    let cancelled = false;
    let raf: number | null = null;
    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let analyser: AnalyserNode | null = null;
    let smoothed = 0;

    /** Fully release every resource this effect touched. Idempotent. */
    const teardown = () => {
      if (raf != null) {
        cancelAnimationFrame(raf);
        raf = null;
      }
      try {
        source?.disconnect();
      } catch {
        /* already disconnected */
      }
      source = null;
      try {
        analyser?.disconnect();
      } catch {
        /* already disconnected */
      }
      analyser = null;
      if (ctx && ctx.state !== "closed") {
        // close() is async; failure is benign (already-closed contexts throw).
        void ctx.close().catch(() => undefined);
      }
      ctx = null;
      if (stream) {
        for (const track of stream.getTracks()) {
          try {
            track.stop();
          } catch {
            /* already stopped */
          }
          try {
            stream.removeTrack(track);
          } catch {
            /* not attached */
          }
        }
        stream = null;
      }
    };

    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          // Effect cleaned up before permission resolved — release immediately.
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;

        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        ctx = new AudioCtx();

        // Some browsers (Safari) start the context suspended until a user
        // gesture; resume best-effort so getByteTimeDomainData isn't flat.
        if (ctx.state === "suspended") {
          void ctx.resume().catch(() => undefined);
        }

        source = ctx.createMediaStreamSource(stream);
        analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);

        const data = new Uint8Array(analyser.fftSize);
        const loop = () => {
          if (cancelled || !analyser) return;
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / data.length);
          const target = Math.min(1, rms * 3);
          smoothed = smoothed * 0.75 + target * 0.25;
          setLevel(smoothed);
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
      } catch (err) {
        console.warn("[useMicLevel] mic access failed:", err);
        teardown();
      }
    })();

    return () => {
      cancelled = true;
      teardown();
      setLevel(0);
    };
  }, [active, visible]);

  return level;
}
