import { useCallback, useEffect, useRef, useState } from "react";
import { startMicTest, type Controller } from "@/lib/voice-providers";

export function useMicTest(setLevel: (n: number) => void, setError: (s: string | null) => void) {
  const [micTest, setMicTest] = useState(false);
  const ctrlRef = useRef<Controller | null>(null);

  const stop = useCallback(() => {
    ctrlRef.current?.stop();
    ctrlRef.current = null;
    setMicTest(false);
    setLevel(0);
  }, [setLevel]);

  const start = useCallback(async () => {
    // Guard against double-start leaking the previous controller.
    if (ctrlRef.current) {
      ctrlRef.current.stop();
      ctrlRef.current = null;
    }
    const unmounted = () => !mountedRef.current;
    try {
      const ctrl = await startMicTest((rms) => setLevel(rms));
      // If the component unmounted while we awaited, discard this controller.
      if (unmounted()) {
        ctrl.stop();
        return;
      }
      ctrlRef.current = ctrl;
      setMicTest(true);
      setError(null);
    } catch {
      setError("Could not access microphone for test.");
    }
  }, [setLevel, setError]);

  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; ctrlRef.current?.stop(); }, []);

  return { micTest, start, stop, ctrlRef };
}