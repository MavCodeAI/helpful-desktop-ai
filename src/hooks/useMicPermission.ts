/**
 * Track the browser's microphone permission state without triggering the prompt.
 *
 * `navigator.permissions.query({ name: "microphone" })` returns one of
 * "granted" | "denied" | "prompt" and fires `onchange` when the user updates
 * their site permission from the browser UI. Not all browsers implement the
 * "microphone" permission descriptor (older Firefox, some in-app WebViews),
 * so we degrade gracefully to "unknown".
 */
import { useEffect, useState } from "react";

export type MicPermissionState = "granted" | "denied" | "prompt" | "unknown";

export function useMicPermission(): MicPermissionState {
  const [state, setState] = useState<MicPermissionState>("unknown");

  useEffect(() => {
    let cancelled = false;
    let status: PermissionStatus | null = null;
    const onChange = () => {
      if (!cancelled && status) setState(status.state as MicPermissionState);
    };

    (async () => {
      try {
        if (!navigator.permissions?.query) return;
        // Cast — TS lib.dom lacks "microphone" in PermissionName in older targets.
        status = await navigator.permissions.query({
          name: "microphone" as PermissionName,
        });
        if (cancelled) return;
        setState(status.state as MicPermissionState);
        status.addEventListener?.("change", onChange);
      } catch {
        /* unsupported — stay "unknown" */
      }
    })();

    return () => {
      cancelled = true;
      status?.removeEventListener?.("change", onChange);
    };
  }, []);

  return state;
}
