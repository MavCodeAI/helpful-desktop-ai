import { useCallback, useEffect, useState } from "react";

/**
 * Persisted selection of the user's preferred audio input device.
 * Stored in localStorage so it survives reloads. `null` = "use OS default".
 *
 * The stored id is opaque per-origin per-user: if the user clears mic
 * permissions, browsers rotate deviceIds and the saved value silently
 * becomes stale. Callers should validate the id against the current
 * enumerateDevices() list and fall back to default when it's missing.
 */
const STORAGE_KEY = "jarvis.micDeviceId";

function readInitial(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function useMicDeviceId(): [string | null, (id: string | null) => void] {
  const [deviceId, setDeviceIdState] = useState<string | null>(readInitial);

  // Re-read on mount in case SSR returned null but client has a value.
  useEffect(() => {
    const v = readInitial();
    if (v !== deviceId) setDeviceIdState(v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setDeviceId = useCallback((id: string | null) => {
    setDeviceIdState(id);
    try {
      if (id) window.localStorage.setItem(STORAGE_KEY, id);
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage disabled — in-memory only */
    }
  }, []);

  return [deviceId, setDeviceId];
}
