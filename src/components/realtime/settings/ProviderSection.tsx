import { AlertCircle, CheckCircle2, Radio } from "lucide-react";
import { SectionHeader } from "./SectionHeader";
import { useUILang } from "@/hooks/use-ui-lang";

type Props = {
  geminiReady: boolean;
  geminiError: string | null;
};

export function ProviderSection({ geminiReady, geminiError }: Props) {
  const { isUrdu, isArabic } = useUILang();
  const heading = isUrdu ? "وائس کنکشن" : isArabic ? "اتصال الصوت" : "Voice connection";
  const description = isUrdu
    ? "Alpha کی realtime آواز Gemini Live کے ذریعے چلتی ہے۔"
    : isArabic
      ? "يعمل الصوت الفوري في Alpha عبر Gemini Live."
      : "Alpha realtime voice runs through Gemini Live.";
  const readyText = isUrdu
    ? "Gemini Live تیار ہے۔ وائس موڈ شروع کرنے پر مختصر مدت کا محفوظ token بنایا جائے گا۔"
    : isArabic
      ? "Gemini Live جاهز. سيتم إنشاء رمز آمن قصير المدة عند بدء الصوت."
      : "Gemini Live is ready. A short-lived secure token is created when voice mode starts.";
  const setupText = isUrdu
    ? "وائس شروع کرنے سے پہلے نیچے API setup میں key Apply & Test کریں، یا production team key استعمال کریں۔"
    : isArabic
      ? "طبّق واختبر المفتاح في إعداد API أدناه قبل بدء الصوت، أو استخدم مفتاح فريق الإنتاج."
      : "Apply & Test a key in API setup below before starting voice, or use the production team key.";

  return (
    <section>
      <SectionHeader>{heading}</SectionHeader>
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-3">
        <div className="flex items-center gap-2 text-sm text-white/90">
          <Radio className="h-4 w-4 text-cyan-300" aria-hidden="true" />
          <span>Gemini Live</span>
          <span className="ml-auto rounded-full border border-cyan-300/25 bg-cyan-300/10 px-2 py-0.5 text-[9px] uppercase tracking-wider text-cyan-200">
            {isUrdu ? "خودکار" : isArabic ? "تلقائي" : "Default"}
          </span>
        </div>
        <p className="text-[10px] leading-relaxed text-white/55">{description}</p>
        <div className={`flex items-start gap-2 rounded-lg border p-2.5 ${geminiReady ? "border-emerald-300/20 bg-emerald-300/5" : "border-amber-300/25 bg-amber-300/5"}`}>
          {geminiReady ? (
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" aria-hidden="true" />
          ) : (
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" aria-hidden="true" />
          )}
          <p className="text-[10px] leading-relaxed text-white/70">
            {geminiReady ? readyText : (geminiError || setupText)}
          </p>
        </div>
      </div>
    </section>
  );
}
