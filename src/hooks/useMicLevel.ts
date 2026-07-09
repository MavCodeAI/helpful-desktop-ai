import { useEffect, useRef, useState } from "react";

/**
 * Live microphone amplitude (0..1), smoothed.
 *
 * When `active` flips true, requests mic access, wires the stream into a
 * WebAudio AnalyserNode, and starts a RAF loop that pushes an eased RMS
 * value into state. When it flips false, tears everything down.
 *
 * Safe to mount multiple times: each call gets its own mic stream.
 * Returns 0 while inactive or before the browser grants permission.
 */
export function useMicLevel(active: boolean): number {
  const [level, setLevel] = useState(0);
  const rafRef = useRef<number | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let smoothed = 0;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        const ctx = new AudioCtx();
        ctxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        analyserRef.current = analyser;

        const data = new Uint8Array(analyser.fftSize);
        const loop = () => {
          if (cancelled) return;
          analyser.getByteTimeDomainData(data);
          // RMS around 128 midpoint.
          let sum = 0;
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / data.length);
          // Punch up quiet speech, clamp, then ease toward the new value.
          const target = Math.min(1, rms * 3);
          smoothed = smoothed * 0.75 + target * 0.25;
          setLevel(smoothed);
          rafRef.current = requestAnimationFrame(loop);
        };
        rafRef.current = requestAnimationFrame(loop);
      } catch (err) {
        console.warn("[useMicLevel] mic access failed:", err);
      }
    })();

    return () => {
      cancelled = true;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      analyserRef.current?.disconnect();
      analyserRef.current = null;
      void ctxRef.current?.close();
      ctxRef.current = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setLevel(0);
    };
  }, [active]);

  return level;
}
