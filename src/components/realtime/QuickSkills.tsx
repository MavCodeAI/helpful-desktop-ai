import type { LangCode } from "@/lib/persona";

type Props = {
  lang: LangCode;
  onRun: (prompt: string) => void | Promise<void>;
};

type Skill = { id: string; label: string; description: string; prompt: string };

function skillsFor(lang: LangCode): Skill[] {
  if (lang === "ur") {
    return [
      { id: "saudi-sme", label: "سعودی کاروباری بریفنگ", description: "کاروباری خبریں اور اہم معلومات", prompt: "سعودی عرب کے چھوٹے اور درمیانے کاروبار کے لیے مختصر بریفنگ دو: اہم کاروباری خبریں، سرکاری یا ضابطہ جاتی معلومات، ممکنہ مواقع یا خطرات، اور آج کے تین عملی کام۔ جہاں معلومات دستیاب نہ ہوں وہاں واضح بتاؤ۔ جواب صرف اردو رسم الخط میں دو، ہندی، دیوناگری یا رومن اردو استعمال نہ کرو۔" },
      { id: "news", label: "نیوز سناؤ", description: "حالیہ خبریں اور ذرائع", prompt: "سعودی عرب اور میرے منتخب ملک کی تازہ اہم خبریں سناؤ اور ہر خبر کا معتبر ماخذ بھی بتاؤ۔ جواب صرف اردو رسم الخط میں دو۔" },
      { id: "followup", label: "کسٹمر پیغام", description: "مہذب جواب کا مسودہ", prompt: "میرے کسٹمر کے لیے ایک مختصر اور مہذب پیروی کا پیغام اردو رسم الخط میں تیار کرو۔" },
      { id: "focus", label: "آج کے اہم کام", description: "کاروباری کام ترتیب دیں", prompt: "میرے کاروبار کے لیے آج کے تین اہم کام ترجیح کے ساتھ بتاؤ اور ہر کام کا اگلا قدم لکھو۔ جواب صرف اردو رسم الخط میں دو۔" },
    ];
  }
  return [
    { id: "saudi-sme", label: "Saudi SME briefing", description: "Business news, updates and actions", prompt: "Give me a concise briefing for Saudi small and medium businesses: important business news, official or regulatory updates, possible opportunities or risks, and three practical actions for today. Clearly state when information is unavailable. Reply only in clear English; do not use Hindi, Devanagari, or Roman Urdu." },
    { id: "news", label: "Latest news", description: "Fresh headlines with sources", prompt: "Tell me the latest important news from Saudi Arabia and my selected country, and cite every source. Reply in my selected language." },
    { id: "followup", label: "Customer message", description: "Polite message draft", prompt: "Draft a short, polite customer follow-up message in my selected language." },
    { id: "focus", label: "Today's priorities", description: "Prioritize business work", prompt: "Give me the three most important tasks for my business today, in priority order, with the next step for each." },
  ];
}

export function QuickSkills({ lang, onRun }: Props) {
  const skills = skillsFor(lang);
  return (
    <section className="relative z-10 mx-auto mt-3 w-[min(92vw,760px)]" aria-label="Quick skills">
      <div className="mb-1.5 flex items-center justify-between px-1">
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">{lang === "ur" ? "فوری کام" : "Quick skills"}</span>
        <span className="text-[10px] text-white/30">{lang === "ur" ? "منتخب کریں · منظوری برقرار ہے" : "Tap to run · approval stays on"}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {skills.map((skill) => (
          <button
            key={skill.id}
            type="button"
            onClick={() => void onRun(skill.prompt)}
            className="group rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2.5 text-left transition hover:border-cyan-300/30 hover:bg-cyan-300/[0.07] focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
          >
            <span className="block text-xs font-medium text-white/80 group-hover:text-cyan-100">{skill.label}</span>
            <span className="mt-0.5 block text-[10px] leading-snug text-white/40">{skill.description}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
