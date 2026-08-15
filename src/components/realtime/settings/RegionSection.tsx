import { SectionHeader } from "./SectionHeader";
import { useUILang } from "@/hooks/use-ui-lang";
import {
  SUPPORTED_COUNTRIES,
  type CountryCode,
  type TimezoneMode,
} from "@/lib/locale";

interface Props {
  country: CountryCode;
  timezoneMode: TimezoneMode;
  changeCountry: (country: CountryCode) => void;
  changeTimezoneMode: (mode: TimezoneMode) => void;
}

export function RegionSection({ country, timezoneMode, changeCountry, changeTimezoneMode }: Props) {
  const { isUrdu, isArabic } = useUILang();
  const heading = isUrdu ? "ملک اور علاقہ" : isArabic ? "البلد والمنطقة" : "Country & region";
  const countryLabel = isUrdu ? "مقامی مارکیٹ" : isArabic ? "السوق المحلي" : "Local market";
  const timezoneLabel = isUrdu ? "وقت کا زون" : isArabic ? "المنطقة الزمنية" : "Timezone";
  const countryTime = isUrdu ? "منتخب ملک کا وقت" : isArabic ? "وقت البلد المختار" : "Selected country time";
  const deviceTime = isUrdu ? "ڈیوائس کا وقت" : isArabic ? "وقت الجهاز" : "Device time";

  return (
    <section>
      <SectionHeader>{heading}</SectionHeader>
      <label className="block text-[10px] uppercase tracking-widest text-white/60 mb-1.5" htmlFor="alpha-country">
        {countryLabel}
      </label>
      <select
        id="alpha-country"
        value={country}
        onChange={(event) => changeCountry(event.target.value as CountryCode)}
        className="w-full rounded-md border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/60"
      >
        {SUPPORTED_COUNTRIES.map((option) => (
          <option key={option.code} value={option.code} className="bg-slate-900 text-white">
            {isUrdu || isArabic ? option.nativeLabel : option.label} ({option.code})
          </option>
        ))}
      </select>
      <label className="block text-[10px] uppercase tracking-widest text-white/60 mt-3 mb-1.5" htmlFor="alpha-timezone-mode">
        {timezoneLabel}
      </label>
      <select
        id="alpha-timezone-mode"
        value={timezoneMode}
        onChange={(event) => changeTimezoneMode(event.target.value as TimezoneMode)}
        className="w-full rounded-md border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/60"
      >
        <option value="country" className="bg-slate-900 text-white">{countryTime}</option>
        <option value="device" className="bg-slate-900 text-white">{deviceTime}</option>
      </select>
      <p className="mt-2 text-[10px] leading-relaxed text-white/50">
        {isUrdu
          ? "Alpha خبریں، مثالیں اور وقت منتخب ملک کے مطابق سمجھے گا؛ سوال میں دوسرا ملک کہیں تو وہ ترجیح دی جائے گی۔"
          : isArabic
            ? "سيستخدم Alpha أخبار وأمثلة وتوقيت البلد المختار، ويمكنك تحديد بلد آخر داخل السؤال."
            : "Alpha uses this market for news, examples and time context; an explicit country in your request always takes priority."}
      </p>
    </section>
  );
}
