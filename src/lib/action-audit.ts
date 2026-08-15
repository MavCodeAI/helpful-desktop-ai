export type ActionAuditStatus = "pending" | "approved" | "rejected" | "completed" | "failed";

export type ActionAuditRecord = {
  id: string;
  at: number;
  status: ActionAuditStatus;
  kind: string;
  label: string;
  url?: string;
};

const KEY = "alpha_action_audit_v1";
const MAX_RECORDS = 100;

function read(): ActionAuditRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is ActionAuditRecord => Boolean(item && typeof item === "object")) : [];
  } catch {
    return [];
  }
}

function write(records: ActionAuditRecord[]) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(KEY, JSON.stringify(records.slice(0, MAX_RECORDS))); } catch { /* storage may be unavailable */ }
}

export function appendActionAudit(record: ActionAuditRecord) {
  write([record, ...read()]);
}

export function updateActionAudit(id: string, status: ActionAuditStatus) {
  write(read().map((record) => record.id === id ? { ...record, status } : record));
}

export function loadActionAudit(): ActionAuditRecord[] {
  return read();
}

export function clearActionAudit() {
  if (typeof window !== "undefined") window.localStorage.removeItem(KEY);
}
