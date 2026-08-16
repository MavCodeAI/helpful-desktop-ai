export type BusinessProfile = {
  businessName: string;
  industry: string;
  city: string;
  vatRegistered: boolean;
  currency: "SAR";
  workingHours: string;
  tone: "formal" | "friendly" | "direct";
};

export type ReminderRepeat = "none" | "daily" | "weekly" | "monthly";

export type BusinessReminder = {
  id: string;
  title: string;
  dueDate: string;
  category: "tax" | "license" | "payment" | "meeting" | "other";
  notes: string;
  repeat: ReminderRepeat;
  completed: boolean;
};

const PROFILE_KEY = "alpha_business_profile";
const REMINDERS_KEY = "alpha_business_reminders";

const DEFAULT_PROFILE: BusinessProfile = {
  businessName: "",
  industry: "",
  city: "",
  vatRegistered: false,
  currency: "SAR",
  workingHours: "",
  tone: "formal",
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Local-only settings are best effort when storage is unavailable.
  }
}

export function loadBusinessProfile(): BusinessProfile {
  const value = read<Partial<BusinessProfile>>(PROFILE_KEY, {});
  return { ...DEFAULT_PROFILE, ...value, currency: "SAR" };
}

export function saveBusinessProfile(profile: BusinessProfile) {
  write(PROFILE_KEY, { ...profile, currency: "SAR" });
}

export function clearBusinessProfile() {
  try { localStorage.removeItem(PROFILE_KEY); } catch { /* noop */ }
}

export function loadBusinessReminders(): BusinessReminder[] {
  const value = read<Partial<BusinessReminder>[]>(REMINDERS_KEY, []);
  return Array.isArray(value) ? value.filter((item) => item && typeof item.id === "string").map((item) => ({
    id: item.id!, title: item.title ?? "", dueDate: item.dueDate ?? "", category: item.category ?? "other", notes: item.notes ?? "", repeat: item.repeat ?? "none", completed: Boolean(item.completed),
  })) : [];
}

export function saveBusinessReminders(reminders: BusinessReminder[]) {
  write(REMINDERS_KEY, reminders.slice(0, 100));
}

export function addBusinessReminder(reminder: Omit<BusinessReminder, "id" | "completed">) {
  const next: BusinessReminder = { ...reminder, id: crypto.randomUUID(), repeat: reminder.repeat ?? "none", completed: false };
  saveBusinessReminders([next, ...loadBusinessReminders()]);
  return next;
}

function nextDate(value: string, repeat: ReminderRepeat): string {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime()) || repeat === "none") return value;
  if (repeat === "daily") date.setDate(date.getDate() + 1);
  if (repeat === "weekly") date.setDate(date.getDate() + 7);
  if (repeat === "monthly") date.setMonth(date.getMonth() + 1);
  return date.toISOString().slice(0, 10);
}

export function toggleBusinessReminder(id: string) {
  saveBusinessReminders(loadBusinessReminders().map((item) => {
    if (item.id !== id) return item;
    if (!item.completed && item.repeat !== "none") return { ...item, dueDate: nextDate(item.dueDate, item.repeat), completed: false };
    return { ...item, completed: !item.completed };
  }));
}

export function removeBusinessReminder(id: string) {
  saveBusinessReminders(loadBusinessReminders().filter((item) => item.id !== id));
}

export function clearBusinessData() {
  clearBusinessProfile();
  try { localStorage.removeItem(REMINDERS_KEY); } catch { /* noop */ }
}

export function businessProfilePrompt(profile: BusinessProfile): string {
  const fields = [
    profile.businessName && `Business name: ${profile.businessName}`,
    profile.industry && `Industry: ${profile.industry}`,
    profile.city && `City: ${profile.city}, Saudi Arabia`,
    `Currency: SAR`,
    `VAT registered: ${profile.vatRegistered ? "yes" : "no"}`,
    profile.workingHours && `Working hours: ${profile.workingHours}`,
    `Preferred tone: ${profile.tone}`,
  ].filter(Boolean);
  return fields.length ? `Use this Saudi SME business profile when relevant:\n${fields.join("\n")}` : "No business profile has been configured yet.";
}
