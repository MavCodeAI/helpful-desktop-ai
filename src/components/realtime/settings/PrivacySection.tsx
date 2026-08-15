import { useCallback, useEffect, useState } from "react";
import { ShieldCheck, Trash2 } from "lucide-react";
import { useUILang } from "@/hooks/use-ui-lang";
import {
  clearActionAudit,
  loadActionAudit,
  type ActionAuditRecord,
  type ActionAuditStatus,
} from "@/lib/action-audit";
import { SectionHeader } from "@/components/realtime/settings/SectionHeader";

const STATUS_CLASSES: Record<ActionAuditStatus, string> = {
  pending: "text-amber-200 bg-amber-400/10",
  approved: "text-cyan-200 bg-cyan-400/10",
  rejected: "text-red-200 bg-red-400/10",
  completed: "text-emerald-200 bg-emerald-400/10",
  failed: "text-red-200 bg-red-400/10",
};

export function PrivacySection() {
  const { isUrdu, isArabic } = useUILang();
  const [records, setRecords] = useState<ActionAuditRecord[]>([]);
  const refresh = useCallback(() => setRecords(loadActionAudit()), []);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 1500);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const heading = isUrdu ? "پرائیویسی اور ایکشن لاگ" : isArabic ? "الخصوصية وسجل الإجراءات" : "Privacy & action log";
  const description = isUrdu
    ? "Risky actions کی منظوری، تکمیل اور ناکامی کا مختصر مقامی ریکارڈ۔ raw URLs یہاں نہیں دکھائے جاتے۔"
    : isArabic
      ? "سجل محلي مختصر لموافقات الإجراءات الحساسة ونتائجها. لا تُعرض عناوين URL الكاملة هنا."
      : "A compact local record of sensitive-action approvals and outcomes. Full URLs are never shown here.";
  const empty = isUrdu ? "ابھی کوئی action record نہیں ہے۔" : isArabic ? "لا توجد إجراءات مسجلة بعد." : "No actions recorded yet.";
  const clearLabel = isUrdu ? "ایکشن لاگ صاف کریں" : isArabic ? "مسح سجل الإجراءات" : "Clear action log";
  const statusLabel = (status: ActionAuditStatus) => isUrdu
    ? ({ pending: "زیرِ منظوری", approved: "منظور", rejected: "مسترد", completed: "مکمل", failed: "ناکام" }[status])
    : isArabic
      ? ({ pending: "قيد الموافقة", approved: "موافق", rejected: "مرفوض", completed: "مكتمل", failed: "فشل" }[status])
      : status;

  return (
    <section>
      <SectionHeader>
        <span className="inline-flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" aria-hidden />{heading}</span>
      </SectionHeader>
      <p className="text-[11px] leading-relaxed text-white/50 mb-3">{description}</p>
      <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
        {records.length === 0 && <p className="text-[11px] text-white/55 italic py-2">{empty}</p>}
        {records.slice(0, 25).map((record) => (
          <div key={record.id} className="rounded-md border border-white/5 bg-white/[0.035] px-2.5 py-2">
            <div className="flex items-start gap-2">
              <span className="flex-1 min-w-0 text-[11px] leading-snug text-white/80 break-words">{record.label}</span>
              <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wide ${STATUS_CLASSES[record.status]}`}>
                {statusLabel(record.status)}
              </span>
            </div>
            <time className="block mt-1 text-[9px] text-white/40" dateTime={new Date(record.at).toISOString()}>
              {new Date(record.at).toLocaleString()}
            </time>
          </div>
        ))}
      </div>
      {records.length > 0 && (
        <button
          type="button"
          onClick={() => { clearActionAudit(); refresh(); }}
          className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-red-400/20 bg-red-500/5 px-3 py-1.5 text-[11px] text-red-200/80 hover:bg-red-500/10"
        >
          <Trash2 className="w-3 h-3" aria-hidden />
          {clearLabel}
        </button>
      )}
    </section>
  );
}
