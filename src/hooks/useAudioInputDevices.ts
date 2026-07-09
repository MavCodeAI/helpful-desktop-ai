import { useEffect, useState, useCallback } from "react";

/**
 * Enumerates connected audio input devices ("audioinput") and keeps the
 * list fresh when the user plugs / unplugs a mic (mediaDevices.devicechange).
 *
 * Notes:
 *  - Labels are empty strings until the page has been granted mic permission
 *    at least once. Callers should show a "grant access to see names" hint
 *    when `hasLabels` is false.
 *  - Safe on SSR: returns an empty list and a no-op refresh.
 */
export interface AudioInputDevice {
  deviceId: string;
  label: string;
  groupId: string;
}

export interface AudioInputDevices {
  devices: AudioInputDevice[];
  hasLabels: boolean;
  refresh: () => void;
  supported: boolean;
}

const noop = () => undefined;

export function useAudioInputDevices(): AudioInputDevices {
  const supported =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.enumerateDevices === "function";

  const [devices, setDevices] = useState<AudioInputDevice[]>([]);

  const refresh = useCallback(() => {
    if (!supported) return;
    navigator.mediaDevices
      .enumerateDevices()
      .then((all) => {
        const inputs = all
          .filter((d) => d.kind === "audioinput")
          .map((d) => ({
            deviceId: d.deviceId,
            label: d.label,
            groupId: d.groupId,
          }));
        setDevices(inputs);
      })
      .catch(() => {
        /* Some browsers reject in cross-origin iframes — leave list empty. */
      });
  }, [supported]);

  useEffect(() => {
    if (!supported) return;
    refresh();
    const md = navigator.mediaDevices;
    const handler = () => refresh();
    md.addEventListener?.("devicechange", handler);
    return () => md.removeEventListener?.("devicechange", handler);
  }, [supported, refresh]);

  const hasLabels = devices.some((d) => d.label.length > 0);

  return {
    devices,
    hasLabels,
    refresh: supported ? refresh : noop,
    supported,
  };
}
