import type { LangCode } from "@/lib/persona";

type Props = {
  lang: LangCode;
  onRun: (prompt: string) => void | Promise<void>;
};

type Skill = { id: string; label: string; description: string; prompt: string };

function skillsFor(lang: LangCode): Skill[] {
  if (lang === "ur") {
    return [
      { id: "briefing", label: "صبح کا بریفنگ", description: "نیوز اور آج کی ترجیحات", prompt: "صبح کا بریفنگ دو: میرے منتخب ملک کی تازہ اہم خبریں اور آج کی ترجیحات مختصر اردو میں بتاؤ۔" },
      { id: "news", label: "نیوز سناؤ", description: "حالیہ خبریں اور ذرائع", prompt: "نیوز سناؤ اور ہر خبر کا source بھی بتاؤ۔" },
      { id: "followup", label: "کسٹمر follow-up", description: "مہذب جواب کا مسودہ", prompt: "میرے کسٹمر کے لیے ایک مختصر، مہذب follow-up message اردو میں تیار کرو۔" },
      { id: "focus", label: "آج کا focus plan", description: "اہم کام ترتیب دیں", prompt: "آج کے لیے ایک عملی focus plan بناؤ، پہلے تین اہم کام اور ہر کام کا اگلا قدم بتاؤ۔" },
    ];
  }
  if (lang === "ar") {
    return [
      { id: "briefing", label: "موجز الصباح", description: "الأخبار وأولويات اليوم", prompt: "أعطني موجز الصباح باللغة العربية: أهم أخبار بلدي المختار وأولويات اليوم باختصار." },
      { id: "news", label: "أخبرني بالأخبار", description: "أخبار حديثة مع المصادر", prompt: "أخبرني بآخر الأخبار واذكر مصدر كل خبر." },
      { id: "followup", label: "متابعة عميل", description: "مسودة رد مهذب", prompt: "اكتب رسالة متابعة قصيرة ومهذبة للعميل باللغة العربية." },
      { id: "focus", label: "خطة تركيز اليوم", description: "رتّب أهم المهام", prompt: "أنشئ خطة عملية لليوم مع أهم ثلاث مهام والخطوة التالية لكل مهمة." },
    ];
  }
  return [
    { id: "briefing", label: "Morning briefing", description: "News and priorities", prompt: "Give me a concise morning briefing in my selected language with important news for my selected country and today's priorities." },
    { id: "news", label: "Latest news", description: "Fresh headlines with sources", prompt: "Tell me the latest news and cite every source." },
    { id: "followup", label: "Customer follow-up", description: "Polite message draft", prompt: "Draft a short, polite customer follow-up message in my selected language." },
    { id: "focus", label: "Focus plan", description: "Prioritize today's work", prompt: "Create a practical focus plan for today with the top three tasks and the next step for each." },
  ];
}

export function QuickSkills({ lang, onRun }: Props) {
  const skills = skillsFor(lang);
  return (
    <section className="relative z-10 mx-auto mt-3 w-[min(92vw,760px)]" aria-label="Quick skills">
      <div className="mb-1.5 flex items-center justify-between px-1">
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">Quick skills</span>
        <span className="text-[10px] text-white/30">Tap to run · approval stays on</span>
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
