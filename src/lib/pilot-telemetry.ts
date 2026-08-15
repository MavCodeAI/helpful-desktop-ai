export type PilotEventName =
  | "app_opened"
  | "chat_sent"
  | "chat_failed"
  | "voice_started"
  | "voice_stopped"
  | "action_approved"
  | "action_rejected"
  | "language_selected";

export type PilotEvent = {
  id: string;
  name: PilotEventName;
  at: string;
  properties?: Record<string, string | number | boolean | null>;
};

const STORAGE_KEY = "alpha_pilot_events_v1";
const MAX_EVENTS = 250;

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function loadEvents(): PilotEvent[] {
  if (!canUseStorage()) return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function trackPilotEvent(
  name: PilotEventName,
  properties?: Record<string, string | number | boolean | null>,
) {
  if (!canUseStorage()) return;
  const event: PilotEvent = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    at: new Date().toISOString(),
    properties,
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...loadEvents(), event].slice(-MAX_EVENTS)));
  } catch {
    // Instrumentation must never break the assistant when storage is unavailable.
  }
}

export function getPilotEvents() {
  return loadEvents();
}

export function clearPilotEvents() {
  if (!canUseStorage()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}

