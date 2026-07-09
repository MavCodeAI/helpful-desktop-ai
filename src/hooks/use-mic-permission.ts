import { useEffect, useState } from "react";

export type MicPermission = "unknown" | "granted" | "denied" | "prompt";

export function useMicPermission() {
  const [micPermission, setMicPermission] = useState<MicPermission>("unknown");
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.permissions) return;
    let cancelled = false;
    let ps: PermissionStatus | null = null;
    navigator.permissions
      .query({ name: "microphone" as PermissionName })
      .then((s: PermissionStatus) => {
        if (cancelled) return;
        ps = s;
        setMicPermission(s.state as MicPermission);
        s.onchange = () => setMicPermission(s.state as MicPermission);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (ps) ps.onchange = null;
    };
  }, []);
  return [micPermission, setMicPermission] as const;
}