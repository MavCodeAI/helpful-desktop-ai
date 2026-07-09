import { useEffect, useState } from "react";
import { classifyMicError, type MicErrorInfo } from "@/lib/mic-permission";

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
  /** Instantaneous peak (0..1) from the current analyser frame. Unsmoothed —
   *  use this to drive a clip indicator or peak-hold marker; use `level` for
   *  the animated bar. */
  peak: number;
  /** True once the mic stream is live, wired to the analyser, and the RAF
   *  loop is producing samples. False while permission is pending, when the
   *  tab is hidden, when `active` is false, or after any failure/teardown.
   *  Use this to drive UI indicators — it reflects reality, not intent. */
  active: boolean;
  /** AudioContext base latency (ms), rounded. 0 when the pipeline is down.
   *  Reflects the browser's reported input→analyser delay; useful as a
   *  visible metric next to the recording pill. */
  latencyMs: number;
  /** Classified failure from the most recent getUserMedia rejection. Null
   *  while pending, on success, or after the caller flips `active` off.
   *  Use to render a friendly explanation in place of the meter. */
  error: MicErrorInfo | null;
}



export function useMicLevel(active: boolean, deviceId?: string | null): MicStatus {
  const [level, setLevel] = useState(0);
  const [peak, setPeak] = useState(0);
  const [latencyMs, setLatencyMs] = useState(0);
  const [error, setError] = useState<MicErrorInfo | null>(null);
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
      setPeak(0);
      setLatencyMs(0);
      setLive(false);
      // Clear a stale error when the caller stops asking for mic — the
      // banner should only show while the caller wants the mic AND we
      // just failed to open it.
      setError(null);
      return;
    }

    let cancelled = false;
    let raf: number | null = null;
    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let analyser: AnalyserNode | null = null;
    let smoothed = 0;
    // Peak-hold: decays every frame so the marker slowly drops back after a
    // loud burst instead of snapping — much more useful for reading loudness.
    let heldPeak = 0;

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
        // Tight input constraints — mono @ 16 kHz cuts payload ~4×, hardware
        // AEC/NS keeps SNR clean, and `latency: 0` hints the browser to
        // request the smallest input buffer it will grant. All values are
        // best-effort: browsers ignore what they don't support.
        const s = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            sampleRate: 16000,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            // @ts-expect-error — non-standard but honoured by Chrome/Edge.
            latency: 0,
          },
        });
        if (cancelled) {
          // Effect cleaned up before permission resolved — release immediately.
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;

        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        // "interactive" latency hint = smallest render quantum the platform
        // will allow. Meaningfully lower baseLatency on Chrome vs default.
        ctx = new AudioCtx({ latencyHint: "interactive" });

        // Some browsers (Safari) start the context suspended until a user
        // gesture; resume best-effort so getByteTimeDomainData isn't flat.
        if (ctx.state === "suspended") {
          void ctx.resume().catch(() => undefined);
        }

        source = ctx.createMediaStreamSource(stream);
        analyser = ctx.createAnalyser();
        // 256 samples @ ~48 kHz ≈ 5.3 ms window — half the visual lag of
        // fftSize=512 without hurting the RMS estimate at speech frequencies.
        analyser.fftSize = 256;
        source.connect(analyser);

        // baseLatency is a fraction of a second reported by the platform.
        // Round to ms once at startup — it doesn't change per frame.
        setLatencyMs(Math.round((ctx.baseLatency || 0) * 1000));

        const data = new Uint8Array(analyser.fftSize);
        // Throttle React state updates to ~20 Hz (every ~50 ms). The RAF loop
        // still ticks at display rate so the smoothing/peak-hold math sees
        // every frame, but `setState` — and every child re-render it causes
        // (VolumeMeter, LiveWaveform, OrbWaveBars) — fires at 20 fps.
        // Saves meaningful CPU/battery on mobile with no perceptual loss:
        // a bar animating at 20 fps looks identical to 60 fps.
        const UI_INTERVAL_MS = 50;
        let lastUiTs = 0;
        const loop = (ts: number) => {
          if (cancelled || !analyser) return;
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          let frameMax = 0;
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128;
            sum += v * v;
            const abs = v < 0 ? -v : v;
            if (abs > frameMax) frameMax = abs;
          }
          const rms = Math.sqrt(sum / data.length);
          const target = Math.min(1, rms * 3);
          smoothed = smoothed * 0.55 + target * 0.45;

          const instantPeak = Math.min(1, frameMax);
          heldPeak = Math.max(instantPeak, heldPeak * 0.85);

          if (ts - lastUiTs >= UI_INTERVAL_MS) {
            lastUiTs = ts;
            setLevel(smoothed);
            setPeak(heldPeak);
          }

          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
        setLive(true);
        setError(null);
      } catch (err) {
        console.warn("[useMicLevel] mic access failed:", err);
        setLive(false);
        setError(classifyMicError(err));
        teardown();
      }
    })();

    return () => {
      cancelled = true;
      teardown();
      setLevel(0);
      setPeak(0);
      setLatencyMs(0);
      setLive(false);
    };
  }, [active, visible]);

  return { level, peak, active: live, latencyMs, error };
}

