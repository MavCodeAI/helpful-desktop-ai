import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Bell, CheckCircle2, Clock3, ExternalLink, FileText, LayoutDashboard, ListTodo, RefreshCw, Settings2, ShieldCheck } from "lucide-react";
import { loadBusinessProfile, loadBusinessReminders, type BusinessReminder } from "@/lib/business-profile";
import { loadActionAudit, type ActionAuditRecord } from "@/lib/action-audit";
import { loadLang } from "@/lib/persona";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
  head: () => ({ meta: [{ title: "Dashboard · Alpha" }, { name: "description", content: "Alpha Saudi SME productivity dashboard." }] }),
});

function DashboardPage() {
  const [, setLang] = useState("ur");
  const [profileName, setProfileName] = useState("");
  const [reminders, setReminders] = useState<BusinessReminder[]>([]);
  const [audits, setAudits] = useState<ActionAuditRecord[]>([]);
  const urdu = false;

  const refresh = () => {
    setLang(loadLang());
    setProfileName(loadBusinessProfile().businessName);
    setReminders(loadBusinessReminders());
    setAudits(loadActionAudit());
  };
  useEffect(() => { refresh(); }, []);

  const copy = useMemo(() => urdu ? {
    back: "واپس", title: "کاروباری ڈیش بورڈ", subtitle: "آپ کے Alpha کام، یاددہانیاں اور محفوظ actions ایک نظر میں۔", profile: "پروفائل", configure: "پروفائل مکمل کریں", reminders: "یاددہانیاں", pending: "باقی", done: "مکمل", actions: "حالیہ actions", today: "آج", dueSoon: "قریب آنے والی", noReminders: "کوئی یاددہانی نہیں", noActions: "ابھی کوئی action record نہیں ہوا", open: "کھولیں", refresh: "تازہ کریں", quick: "فوری کام", whatsapp: "WhatsApp مسودہ", email: "Email مسودہ", briefing: "کاروباری بریفنگ", security: "Approval حفاظت فعال ہے", securityText: "WhatsApp، Email اور desktop actions user approval کے بغیر نہیں چلتے۔", todayActions: "آج کے actions", nextStep: "اگلا بہترین قدم", finishProfile: "اپنا business profile مکمل کریں تاکہ Alpha بہتر context استعمال کرے۔", reviewReminder: "اپنی اگلی reminder دیکھیں", allClear: "ابھی کوئی فوری کام نہیں۔"
  } : {
    back: "Back", title: "Business dashboard", subtitle: "Your Alpha work, reminders, and approved actions in one view.", profile: "Profile", configure: "Complete profile", reminders: "Reminders", pending: "Pending", done: "Done", actions: "Recent actions", today: "Today", dueSoon: "Upcoming", noReminders: "No reminders yet", noActions: "No actions recorded yet", open: "Open", refresh: "Refresh", quick: "Quick actions", whatsapp: "WhatsApp draft", email: "Email draft", briefing: "Business briefing", security: "Approval safety is active", securityText: "WhatsApp, email, and desktop actions require user approval before they run.", todayActions: "Actions today", nextStep: "Next best step", finishProfile: "Complete your business profile so Alpha can use better context.", reviewReminder: "Review your next reminder", allClear: "No urgent work right now."
  }, [urdu]);

  const pending = reminders.filter((item) => !item.completed);
  const completed = reminders.filter((item) => item.completed);
  const today = new Date().toISOString().slice(0, 10);
  const dueSoon = pending.filter((item) => item.dueDate >= today).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 5);
  const recent = audits.slice(0, 6);
  const actionsToday = audits.filter((item) => new Date(item.at).toISOString().slice(0, 10) === today).length;
  const priority = !profileName ? { label: copy.finishProfile, href: "/business-profile" } : dueSoon[0] ? { label: `${copy.reviewReminder}: ${dueSoon[0].title}`, href: "/business-profile" } : { label: copy.allClear, href: "/business-profile" };
  const displayDate = (value: number) => new Intl.DateTimeFormat(urdu ? "ur-PK" : "en-SA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

  return (
    <main dir={urdu ? "rtl" : "ltr"} className="min-h-dvh bg-[radial-gradient(ellipse_at_top,oklch(0.18_0.05_260),oklch(0.09_0.02_240)_60%)] text-white/90">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <header className="mb-7 flex items-center justify-between gap-3">
          <Link to="/" className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-xs text-white/70 transition hover:bg-white/5 hover:text-white touch-manipulation"><ArrowLeft className="h-4 w-4" />{copy.back}</Link>
          <div className="flex items-center gap-2"><Link to="/business-profile" className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-white/70 hover:bg-white/10 touch-manipulation"><Settings2 className="h-3.5 w-3.5" />{copy.profile}</Link><span className="text-[10px] uppercase tracking-[0.2em] text-cyan-300/70">ALPHA · SAR</span></div>
        </header>

        <div className="mb-7 flex items-start justify-between gap-4"><div className="flex items-start gap-3"><LayoutDashboard className="mt-1 h-6 w-6 text-cyan-300" /><div><h1 className="text-xl font-semibold sm:text-2xl">{copy.title}</h1><p className="mt-1 text-xs leading-relaxed text-white/55 sm:text-sm">{profileName ? `${profileName} · ` : ""}{copy.subtitle}</p></div></div><button type="button" onClick={refresh} aria-label={copy.refresh} className="min-h-11 min-w-11 rounded-lg border border-white/10 bg-white/5 p-2 text-white/60 hover:bg-white/10 hover:text-white touch-manipulation"><RefreshCw className="h-4 w-4" /></button></div>

        {!profileName && <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-amber-300/25 bg-amber-300/[0.07] p-4 text-xs text-amber-100"><span>{urdu ? "بہتر business context کے لیے اپنا پروفائل مکمل کریں۔" : "Complete your profile for better business context in Gemini."}</span><Link to="/business-profile" className="shrink-0 inline-flex min-h-11 items-center rounded-full border border-amber-200/30 px-3 py-2 hover:bg-amber-200/10 touch-manipulation">{copy.configure}</Link></div>}

        <section className="mb-5 flex items-start gap-3 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.06] p-4"><ListTodo className="mt-0.5 h-5 w-5 shrink-0 text-cyan-200" /><div className="min-w-0 flex-1"><h2 className="text-xs font-semibold text-cyan-100">{copy.nextStep}</h2><p className="mt-1 text-xs leading-relaxed text-white/65">{priority.label}</p></div><Link to={priority.href} className="shrink-0 inline-flex min-h-11 items-center rounded-full border border-cyan-200/25 px-3 py-2 text-[11px] text-cyan-100 hover:bg-cyan-200/10 touch-manipulation">{copy.open}</Link></section>

        <div className="grid gap-3 sm:grid-cols-4">
          <Stat icon={<Bell className="h-5 w-5" />} label={copy.reminders} value={reminders.length} tone="cyan" />
          <Stat icon={<Clock3 className="h-5 w-5" />} label={copy.pending} value={pending.length} tone="amber" />
          <Stat icon={<CheckCircle2 className="h-5 w-5" />} label={copy.done} value={completed.length} tone="emerald" />
          <Stat icon={<FileText className="h-5 w-5" />} label={copy.todayActions} value={actionsToday} tone="cyan" />
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="glass-card rounded-xl p-4 sm:p-5"><div className="mb-4 flex items-center justify-between"><h2 className="flex items-center gap-2 text-sm font-semibold"><Bell className="h-4 w-4 text-violet-300" />{copy.dueSoon}</h2><Link to="/business-profile" className="text-[11px] text-cyan-200 hover:text-white">{copy.open}</Link></div>{dueSoon.length === 0 ? <p className="py-8 text-center text-xs text-white/40">{copy.noReminders}</p> : <div className="space-y-2">{dueSoon.map((item) => <ReminderRow key={item.id} item={item} urdu={urdu} />)}</div>}</section>
          <section className="glass-card rounded-xl p-4 sm:p-5"><h2 className="mb-4 flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-emerald-300" />{copy.security}</h2><p className="text-xs leading-relaxed text-white/55">{copy.securityText}</p><div className="mt-4 rounded-lg border border-emerald-300/15 bg-emerald-300/[0.06] p-3 text-[11px] text-emerald-100/80">{urdu ? "ہر external link سے پہلے واضح اجازت طلب کی جاتی ہے۔" : "Every external link asks for explicit approval first."}</div></section>
        </div>

        <section className="glass-card mt-5 rounded-xl p-4 sm:p-5"><h2 className="mb-4 flex items-center gap-2 text-sm font-semibold"><FileText className="h-4 w-4 text-cyan-300" />{copy.actions}</h2>{recent.length === 0 ? <p className="py-5 text-center text-xs text-white/40">{copy.noActions}</p> : <div className="space-y-2">{recent.map((item) => <div key={item.id} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3"><span className={`h-2 w-2 rounded-full ${item.status === "completed" ? "bg-emerald-300" : item.status === "rejected" ? "bg-red-300" : "bg-amber-300"}`} /><div className="min-w-0 flex-1"><div className="truncate text-xs text-white/85">{item.label}</div><div className="mt-1 text-[10px] text-white/40">{item.kind} · {displayDate(item.at)}</div></div><span className="text-[10px] uppercase text-white/45">{item.status}</span></div>)}</div>}</section>

        <section className="mt-5"><h2 className="mb-3 text-sm font-semibold text-white/80">{copy.quick}</h2><div className="grid gap-2 sm:grid-cols-3"><QuickLink href="/?open=chat&command=Draft%20a%20WhatsApp%20follow-up%20for%20my%20customer" icon="WA" label={copy.whatsapp} /><QuickLink href="/?open=chat&command=Draft%20a%20professional%20follow-up%20email" icon="@" label={copy.email} /><QuickLink href="/?open=chat&command=Prepare%20today%27s%20business%20briefing" icon="AI" label={copy.briefing} /></div></section>
      </div>
    </main>
  );
}

function Stat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: "cyan" | "amber" | "emerald" }) {
  const colors = { cyan: "text-cyan-200 border-cyan-300/15", amber: "text-amber-200 border-amber-300/15", emerald: "text-emerald-200 border-emerald-300/15" };
  return <div className={`rounded-xl border bg-white/[0.03] p-4 ${colors[tone]}`}><div className="flex items-center justify-between"><span className="opacity-80">{icon}</span><span className="text-2xl font-semibold">{value}</span></div><div className="mt-2 text-xs text-white/55">{label}</div></div>;
}

function ReminderRow({ item, urdu }: { item: BusinessReminder; urdu: boolean }) {
  return <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3"><span className="h-2 w-2 shrink-0 rounded-full bg-violet-300" /><div className="min-w-0 flex-1"><div className="truncate text-xs font-medium">{item.title}</div><div className="mt-1 truncate text-[10px] text-white/45">{item.dueDate}{item.notes ? ` · ${item.notes}` : ""}</div></div><span className="shrink-0 text-[10px] text-white/45">{urdu ? "باقی" : "Pending"}</span></div>;
}

function QuickLink({ href, icon, label }: { href: string; icon: string; label: string }) {
  return <Link to={href} className="flex min-h-11 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-white/75 transition hover:border-cyan-300/25 hover:bg-cyan-300/[0.06] touch-manipulation"><span className="grid h-8 w-8 place-items-center rounded-lg bg-cyan-300/10 text-[10px] font-semibold text-cyan-200">{icon}</span><span className="flex-1">{label}</span><ExternalLink className="h-3.5 w-3.5 text-white/30" /></Link>;
}
