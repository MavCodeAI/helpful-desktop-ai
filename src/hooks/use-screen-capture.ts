// One-frame screen capture via getDisplayMedia. Browser shows the native
// picker; user selects a tab/window/screen. We grab one frame and immediately
// stop the stream — no continuous recording, no privacy surprises.
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { describeScreen } from "@/lib/ai-vision.functions";

type Options = {
  onResult: (description: string) => void;
  onStart?: () => void;
  geminiKey?: string;
};

async function grabFrame(): Promise<string> {
  const md = navigator.mediaDevices as MediaDevices & {
    getDisplayMedia?: (c: DisplayMediaStreamOptions) => Promise<MediaStream>;
  };
  if (!md?.getDisplayMedia) throw new Error("Screen capture not supported in this browser.");

  const stream = await md.getDisplayMedia({
    video: { frameRate: 1 },
    audio: false,
  });
  try {
    const track = stream.getVideoTracks()[0];
    if (!track) throw new Error("No video track from display capture.");

    const IC = (window as unknown as { ImageCapture?: new (t: MediaStreamTrack) => { grabFrame: () => Promise<ImageBitmap> } }).ImageCapture;
    let bitmap: ImageBitmap | null = null;
    if (IC) {
      try {
        const ic = new IC(track);
        bitmap = await ic.grabFrame();
      } catch { bitmap = null; }
    }

    let width: number, height: number;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D unavailable.");

    if (bitmap) {
      width = bitmap.width; height = bitmap.height;
      canvas.width = width; canvas.height = height;
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close?.();
    } else {
      const video = document.createElement("video");
      video.srcObject = stream;
      video.muted = true;
      await video.play();
      await new Promise((r) => setTimeout(r, 250));
      width = video.videoWidth || 1280;
      height = video.videoHeight || 720;
      canvas.width = width; canvas.height = height;
      ctx.drawImage(video, 0, 0, width, height);
      video.pause();
      video.srcObject = null;
    }

    if (width > 1600) {
      const scale = 1600 / width;
      const scaled = document.createElement("canvas");
      scaled.width = 1600;
      scaled.height = Math.round(height * scale);
      const sctx = scaled.getContext("2d");
      sctx?.drawImage(canvas, 0, 0, scaled.width, scaled.height);
      return scaled.toDataURL("image/jpeg", 0.82);
    }
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    for (const t of stream.getTracks()) t.stop();
  }
}

export function useScreenCapture(opts: Options) {
  const [busy, setBusy] = useState(false);
  const onResultRef = useRef(opts.onResult);
  const onStartRef = useRef(opts.onStart);
  const geminiKeyRef = useRef(opts.geminiKey ?? "");
  onStartRef.current = opts.onStart;
  geminiKeyRef.current = opts.geminiKey ?? "";

  const capture = useCallback(async (prompt?: string) => {
    if (busy) return;
    setBusy(true);
    const tId = toast.loading("📸 Capturing screen…");
    try {
      onStartRef.current?.();
      const imageDataUrl = await grabFrame();
      toast.loading("👁️ Analyzing screen…", { id: tId });
      const [header, imageBase64] = imageDataUrl.split(",", 2);
      const mimeType = header.match(/^data:([^;]+);base64$/)?.[1] ?? "image/jpeg";
      const { text } = await describeScreen({ data: { imageBase64, mimeType, prompt, userKey: geminiKeyRef.current || undefined } });
      toast.success("Screen analyzed", { id: tId });
      onResultRef.current(text);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Screen capture failed";
      if (/permission|denied|abort/i.test(msg)) {
        toast.dismiss(tId);
      } else {
        toast.error(msg, { id: tId });
      }
    } finally {
      setBusy(false);
    }
  }, [busy]);

  return { busy, capture };
}
