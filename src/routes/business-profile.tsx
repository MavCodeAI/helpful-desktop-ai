import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Bell, Building2, Check, Plus, Trash2 } from "lucide-react";
import {
  addBusinessReminder,
  loadBusinessProfile,
  loadBusinessReminders,
  removeBusinessReminder,
  saveBusinessProfile,
  toggleBusinessReminder,
  type BusinessProfile,
  type BusinessReminder,
} from "@/lib/business-profile";
import { loadLang, type LangCode } from "@/lib/persona";

export const Route = createFileRoute("/business-profile")({
  component: BusinessProfilePage,
  head: () => ({
    meta: [
      { title: "Business Profile · Alpha" },
      { name: "description", content: "Configure your Saudi SME profile and local reminders." },
    ],
  }),
});

const emptyProfile: BusinessProfile = {
  businessName: "",
  industry: "",
  city: "",
  vatRegistered: false,
  currency: "SAR",
  workingHours: "",
  tone: "formal",
};

function BusinessProfilePage() {
  const [lang, setLang] = useState<LangCode>("ur");
  const [profile, setProfile] = useState<BusinessProfile>(emptyProfile);
  const [reminders, setReminders] = useState<BusinessReminder[]>([]);
  const [newReminder, setNewReminder] = useState({ title: "", dueDate: "", category: "other" as BusinessReminder["category"], notes: "" });

  useEffect(() => {
    setLang(loadLang());
    setProfile(loadBusinessProfile());
    setReminders(loadBusinessReminders());
  }, []);

  const urdu = lang === "ur";
  const copy = useMemo(() => urdu ? {
    back: "واپس",
    title: "کاروباری پروفائل",
    subtitle: "اپنے سعودی کاروبار کی معلومات اور اہم یاددہانیاں محفوظ کریں۔ یہ ڈیٹا اسی device پر رہتا ہے۔",
    profile: "کاروباری معلومات",
    name: "کاروبار کا نام",
    industry: "کاروباری شعبہ",
    city: "شہر",
    hours: "کام کے اوقات",
    tone: "جواب کا انداز",
    formal: "رسمی",
    friendly: "دوستانہ",
    direct: "مختصر اور براہِ راست",
    vat: "VAT میں رجسٹرڈ ہے",
    save: "محفوظ کریں",
    saved: "محفوظ ہو گیا",
    reminders: "کاروباری یاددہانیاں",
    reminderTitle: "یاددہانی کا عنوان",
    due: "آخری تاریخ",
    category: "قسم",
    notes: "نوٹس",
    add: "یاددہانی شامل کریں",
    empty: "ابھی کوئی یاددہانی نہیں۔",
    completed: "مکمل",
    pending: "باقی",
    tax: "ٹیکس",
    license: "لائسنس",
    payment: "ادائیگی",
    meeting: "میٹنگ",
    other: "دیگر",
  } : {
    back: "Back",
    title: "Business profile",
    subtitle: "Save your Saudi business context and important reminders. This data stays on this device.",
    profile: "Business details",
    name: "Business name",
    industry: "Industry",
    city: "City",
    hours: "Working hours",
    tone: "Response tone",
    formal: "Formal",
    friendly: "Friendly",
    direct: "Direct",
    vat: "VAT registered",
    save: "Save profile",
    saved: "Saved",
    reminders: "Business reminders",
    reminderTitle: "Reminder title",
    due: "Due date",
    category: "Category",
    notes: "Notes",
    add: "Add reminder",
    empty: "No reminders yet.",
    completed: "Done",
    pending: "Pending",
    tax: "Tax",
    license: "License",
    payment: "Payment",
    meeting: "Meeting",
    other: "Other",
  }, [urdu]);

  const update = <K extends keyof BusinessProfile>(key: K, value: BusinessProfile[K]) => setProfile((current) => ({ ...current, [key]: value }));
  const save = () => saveBusinessProfile(profile);
  const addReminder = () => {
    if (!newReminder.title.trim() || !newReminder.dueDate) return;
    addBusinessReminder({ ...newReminder, title: newReminder.title.trim(), notes: newReminder.notes.trim() });
    setReminders(loadBusinessReminders());
    setNewReminder({ title: "", dueDate: "", category: "other", notes: "" });
  };

  const categoryLabel = (category: BusinessReminder["category"]) => ({ tax: copy.tax, license: copy.license, payment: copy.payment, meeting: copy.meeting, other: copy.other })[category];

  return (
    <main className="min-h-dvh bg-[radial-gradient(ellipse_at_top,oklch(0.18_0.05_260),oklch(0.09_0.02_240)_60%)] text-white/90">
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
        <header className="mb-6 flex items-center justify-between gap-3">
          <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-white/70 transition hover:text-white"><ArrowLeft className="h-4 w-4" />{copy.back}</Link>
          <div className="flex items-center gap-2"><Link to="/dashboard" className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-white/70 hover:bg-white/10">{urdu ? "ڈیش بورڈ" : "Dashboard"}</Link><span className="text-[10px] uppercase tracking-[0.2em] text-cyan-300/70">SAR · Saudi SME</span></div>
        </header>

        <div className="mb-6 flex items-start gap-3"><Building2 className="mt-1 h-6 w-6 text-cyan-300" /><div><h1 className="text-xl font-semibold sm:text-2xl">{copy.title}</h1><p className="mt-1 text-xs leading-relaxed text-white/55 sm:text-sm">{copy.subtitle}</p></div></div>

        <section className="glass-card mb-5 rounded-xl p-4 sm:p-5">
          <h2 className="mb-4 text-sm font-semibold text-white/85">{copy.profile}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-white/55">{copy.name}<input value={profile.businessName} onChange={(e) => update("businessName", e.target.value)} className="mt-1.5 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/50" /></label>
            <label className="text-xs text-white/55">{copy.industry}<input value={profile.industry} onChange={(e) => update("industry", e.target.value)} className="mt-1.5 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/50" /></label>
            <label className="text-xs text-white/55">{copy.city}<input value={profile.city} onChange={(e) => update("city", e.target.value)} placeholder={urdu ? "ریاض" : "Riyadh"} className="mt-1.5 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/50" /></label>
            <label className="text-xs text-white/55">{copy.hours}<input value={profile.workingHours} onChange={(e) => update("workingHours", e.target.value)} placeholder={urdu ? "صبح 9 تا شام 6" : "9 AM to 6 PM"} className="mt-1.5 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/50" /></label>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-white/55">{copy.tone}<select value={profile.tone} onChange={(e) => update("tone", e.target.value as BusinessProfile["tone"])} className="mt-1.5 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"><option value="formal">{copy.formal}</option><option value="friendly">{copy.friendly}</option><option value="direct">{copy.direct}</option></select></label>
            <label className="flex items-center gap-2 self-end rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70"><input type="checkbox" checked={profile.vatRegistered} onChange={(e) => update("vatRegistered", e.target.checked)} className="accent-cyan-300" />{copy.vat}</label>
          </div>
          <button type="button" onClick={save} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg border border-cyan-300/35 bg-cyan-300/15 px-4 text-xs font-medium text-cyan-100 transition hover:bg-cyan-300/25"><Check className="h-4 w-4" />{copy.save}</button>
        </section>

        <section className="glass-card rounded-xl p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-2"><Bell className="h-5 w-5 text-violet-300" /><h2 className="text-sm font-semibold text-white/85">{copy.reminders}</h2></div>
          <div className="grid gap-2 sm:grid-cols-[1.4fr_1fr_1fr]">
            <input value={newReminder.title} onChange={(e) => setNewReminder((v) => ({ ...v, title: e.target.value }))} placeholder={copy.reminderTitle} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-cyan-300/50" />
            <input type="date" value={newReminder.dueDate} onChange={(e) => setNewReminder((v) => ({ ...v, dueDate: e.target.value }))} aria-label={copy.due} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-cyan-300/50" />
            <select value={newReminder.category} onChange={(e) => setNewReminder((v) => ({ ...v, category: e.target.value as BusinessReminder["category"] }))} aria-label={copy.category} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none"><option value="tax">{copy.tax}</option><option value="license">{copy.license}</option><option value="payment">{copy.payment}</option><option value="meeting">{copy.meeting}</option><option value="other">{copy.other}</option></select>
          </div>
          <input value={newReminder.notes} onChange={(e) => setNewReminder((v) => ({ ...v, notes: e.target.value }))} placeholder={copy.notes} className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-cyan-300/50" />
          <button type="button" onClick={addReminder} disabled={!newReminder.title.trim() || !newReminder.dueDate} className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-violet-300/35 bg-violet-300/15 px-3 text-xs text-violet-100 disabled:opacity-40"><Plus className="h-3.5 w-3.5" />{copy.add}</button>

          <div className="mt-4 space-y-2">
            {reminders.length === 0 ? <p className="py-5 text-center text-xs text-white/40">{copy.empty}</p> : reminders.map((item) => <div key={item.id} className={`flex items-start gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3 ${item.completed ? "opacity-55" : ""}`}>
              <button type="button" onClick={() => { toggleBusinessReminder(item.id); setReminders(loadBusinessReminders()); }} aria-label={item.completed ? copy.pending : copy.completed} className={`mt-0.5 h-4 w-4 shrink-0 rounded border ${item.completed ? "border-emerald-300 bg-emerald-300/70" : "border-white/25"}`}>{item.completed ? <Check className="h-3 w-3 text-slate-900" /> : null}</button>
              <div className="min-w-0 flex-1"><div className={`text-xs font-medium ${item.completed ? "line-through" : ""}`}>{item.title}</div><div className="mt-1 text-[10px] text-white/45">{item.dueDate} · {categoryLabel(item.category)}{item.notes ? ` · ${item.notes}` : ""}</div></div>
              <button type="button" onClick={() => { removeBusinessReminder(item.id); setReminders(loadBusinessReminders()); }} aria-label={urdu ? "حذف کریں" : "Delete"} className="text-white/40 transition hover:text-red-200"><Trash2 className="h-4 w-4" /></button>
            </div>)}
          </div>
        </section>
      </div>
    </main>
  );
}
