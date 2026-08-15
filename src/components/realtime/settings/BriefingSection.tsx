import { useUILang } from "@/hooks/use-ui-lang";
import { SectionHeader } from "@/components/realtime/settings/SectionHeader";

interface Props {
  enabled: boolean;
  time: string;
  onToggle: (enabled: boolean) => void;
  onChangeTime: (time: string) => void;
}

export function BriefingSection({ enabled, time, onToggle, onChangeTime }: Props) {
  const { isUrdu, isArabic } = useUILang();
  const heading = isUrdu ? "صبح کی بریفنگ" : isArabic ? "الإحاطة الصباحية" : "Morning briefing";
  const description = isUrdu
    ? "ایپ کھلنے پر روزانہ ایک مختصر briefing تیار ہوگی؛ خبریں آپ کے منتخب ملک اور زبان کے مطابق ہوں گی۔"
    : isArabic
      ? "ينشئ التطبيق إحاطة قصيرة مرة واحدة يوميًا عند فتحه، وفق البلد واللغة المختارين."
      : "Create one concise briefing per day when the app opens, using your selected country and language.";
  const enableLabel = isUrdu ? "روزانہ briefing فعال کریں" : isArabic ? "تفعيل الإحاطة اليومية" : "Enable daily briefing";
  const timeLabel = isUrdu ? "پسندیدہ وقت" : isArabic ? "الوقت المفضل" : "Preferred time";
  const localNote = isUrdu
    ? "یہ ترجیح اسی ڈیوائس پر محفوظ ہے۔ Windows notifications اور cloud scheduling اگلے مرحلے میں شامل ہوں گے۔"
    : isArabic
      ? "يُحفظ هذا الخيار على هذا الجهاز. ستتم إضافة إشعارات Windows والجدولة السحابية لاحقًا."
      : "This preference is stored on this device. Windows notifications and cloud scheduling are planned next.";

  return (
    <section>
      <SectionHeader>{heading}</SectionHeader>
      <p className="text-[11px] leading-relaxed text-white/55 mb-3">{description}</p>
      <label className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2.5 cursor-pointer">
        <span className="text-sm text-white/85">{enableLabel}</span>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => onToggle(event.target.checked)}
          className="h-4 w-4 accent-cyan-300"
        />
      </label>
      <label className="block text-[10px] uppercase tracking-widest text-white/60 mt-3 mb-1.5" htmlFor="alpha-briefing-time">
        {timeLabel}
      </label>
      <input
        id="alpha-briefing-time"
        type="time"
        value={time}
        onChange={(event) => onChangeTime(event.target.value)}
        disabled={!enabled}
        className="w-full rounded-md border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/60 disabled:opacity-40"
      />
      <p className="mt-2 text-[10px] leading-relaxed text-white/45">{localNote}</p>
    </section>
  );
}
