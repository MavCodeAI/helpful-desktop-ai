import { useCallback, useState } from "react";

const STORAGE_KEY = "alpha.morningBriefing.v1";
const DEFAULT_TIME = "08:00";

type StoredBriefing = {
  enabled?: boolean;
  time?: string;
  lastRun?: string | null;
};

function loadBriefing(): Required<StoredBriefing> {
  if (typeof window === "undefined") {
    return { enabled: false, time: DEFAULT_TIME, lastRun: null };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { enabled: false, time: DEFAULT_TIME, lastRun: null };
    const parsed = JSON.parse(raw) as StoredBriefing;
    return {
      enabled: parsed.enabled === true,
      time: /^([01]\d|2[0-3]):[0-5]\d$/.test(parsed.time ?? "") ? parsed.time! : DEFAULT_TIME,
      lastRun: typeof parsed.lastRun === "string" ? parsed.lastRun : null,
    };
  } catch {
    return { enabled: false, time: DEFAULT_TIME, lastRun: null };
  }
}

function saveBriefing(value: Required<StoredBriefing>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Private browsing or a restricted WebView may deny localStorage.
  }
}

export function useBriefingSettings() {
  const [state, setState] = useState<Required<StoredBriefing>>(loadBriefing);

  const update = useCallback((patch: Partial<Required<StoredBriefing>>) => {
    setState((current) => {
      const next = { ...current, ...patch };
      saveBriefing(next);
      return next;
    });
  }, []);

  const toggleBriefing = useCallback((enabled: boolean) => update({ enabled }), [update]);
  const changeBriefingTime = useCallback((time: string) => {
    if (/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) update({ time });
  }, [update]);
  const markBriefingRun = useCallback((dayKey = new Date().toISOString().slice(0, 10)) => {
    update({ lastRun: dayKey });
  }, [update]);

  return {
    ...state,
    toggleBriefing,
    changeBriefingTime,
    markBriefingRun,
  };
}

export function loadMorningBriefingSettings() {
  return loadBriefing();
}
