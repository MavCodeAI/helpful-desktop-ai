import { useState } from "react";
import type { LangCode } from "@/lib/persona";

type Props = {
  lang: LangCode;
  onRun: (prompt: string) => void | Promise<void>;
};

type Skill = { id: string; label: string; description: string; prompt: string };

function skillsFor(lang: LangCode): Skill[] {
  if (lang === "ur") {
    return [
      {
        id: "saudi-sme",
        label: "سعودی کاروباری بریفنگ",
        description: "خبریں، معلومات اور آج کے کام",
        prompt: "سعودی عرب کے چھوٹے اور درمیانے کاروبار کے لیے مختصر بریفنگ دو: اہم کاروباری خبریں، سرکاری یا ضابطہ جاتی معلومات، ممکنہ مواقع یا خطرات، اور آج کے تین عملی کام۔ جہاں معلومات دستیاب نہ ہوں وہاں واضح بتاؤ۔ جواب صرف اردو رسم الخط میں دو، ہندی، دیوناگری یا رومن اردو استعمال نہ کرو۔",
      },
      {
        id: "whatsapp",
        label: "واٹس ایپ پیغام",
        description: "کسٹمر کے لیے مسودہ",
        prompt: "میرے کسٹمر یا سپلائر کے لیے ایک مختصر، واضح اور مہذب واٹس ایپ پیغام اردو رسم الخط میں تیار کرو۔ پہلے مقصد اور لہجہ پوچھو اگر معلومات کم ہوں۔ پیغام خود نہ بھیجو، صرف مسودہ دو۔",
      },
      {
        id: "quote",
        label: "قیمت کا تخمینہ",
        description: "پیشہ ورانہ quotation مسودہ",
        prompt: "میرے کاروبار کے لیے ایک پیشہ ورانہ quotation کا مسودہ تیار کرو۔ آئٹم، مقدار، قیمت، VAT، ترسیل، ادائیگی کی شرائط اور میعاد کو واضح جدول میں رکھو۔ نامکمل معلومات کے لیے پہلے سوال پوچھو۔ جواب اردو رسم الخط میں دو۔",
      },
      {
        id: "meeting",
        label: "میٹنگ کا خلاصہ",
        description: "فیصلے اور اگلے کام",
        prompt: "میرے دیے گئے میٹنگ نوٹس یا گفتگو کا خلاصہ بناؤ۔ فیصلے، ذمہ دار افراد، آخری تاریخیں، خطرات اور اگلے کام الگ الگ لکھو۔ اگر متن موجود نہ ہو تو مجھ سے نوٹس پیسٹ کرنے کو کہو۔ جواب اردو رسم الخط میں دو۔",
      },
      {
        id: "complaint",
        label: "شکایت کا جواب",
        description: "ہمدرد اور پیشہ ورانہ مسودہ",
        prompt: "کسٹمر کی شکایت کے لیے ہمدرد، مختصر اور پیشہ ورانہ جواب اردو رسم الخط میں تیار کرو۔ مسئلہ تسلیم کرو، حل یا اگلا قدم بتاؤ، اور ایسا وعدہ نہ کرو جو یقینی نہ ہو۔ جواب خود نہ بھیجو، صرف مسودہ دو۔",
      },
      {
        id: "sales",
        label: "فروخت کا فالو اَپ",
        description: "ترجیحات اور پیغامات",
        prompt: "میرے آج کے sales follow-up کام کو ترتیب دو۔ ہر کسٹمر کے لیے ترجیح، اگلا قدم اور مختصر اردو پیغام کا مسودہ بناؤ۔ اگر کسٹمر کی فہرست موجود نہ ہو تو مجھ سے فہرست مانگو۔",
      },
      {
        id: "expense",
        label: "خرچ کی درجہ بندی",
        description: "کاروباری اخراجات منظم کریں",
        prompt: "میرے دیے گئے اخراجات کو کرایہ، تنخواہ، ترسیل، مارکیٹنگ، سامان اور دیگر مناسب categories میں تقسیم کرو، کل رقم نکالو اور غیر واضح entries کی نشاندہی کرو۔ مالی مشورہ نہ دو؛ صرف منظم خلاصہ اردو رسم الخط میں دو۔",
      },
      {
        id: "compliance",
        label: "کاروباری یاددہانی",
        description: "ZATCA اور اہم deadlines",
        prompt: "سعودی کاروبار کے لیے میری compliance اور renewal یاددہانیوں کی فہرست بناؤ، مثلاً ZATCA، VAT، Commercial Registration اور licenses۔ موجودہ قوانین یا تاریخوں کے لیے معتبر تازہ sources تلاش کرو، غیر یقینی بات کو واضح کرو، اور اسے قانونی مشورہ نہ بناؤ۔ جواب اردو رسم الخط میں دو۔",
      },
      {
        id: "translate",
        label: "کاروباری ترجمہ",
        description: "عربی پیغام سمجھیں، اردو جواب دیں",
        prompt: "میرے دیے گئے عربی کاروباری پیغام کا مطلب واضح اردو رسم الخط میں سمجھاؤ اور مناسب اردو یا English جواب کا مسودہ دو۔ ہندی، دیوناگری اور رومن اردو استعمال نہ کرو۔",
      },
      {
        id: "document",
        label: "دستاویز کا جائزہ",
        description: "اہم نکات اور خطرات",
        prompt: "منسلک یا فراہم کردہ کاروباری دستاویز کا جائزہ لو اور اہم شرائط، رقم، تاریخیں، ذمہ داریاں، خطرات اور اگلے کام نکالو۔ قانونی فیصلہ نہ دو؛ صرف معلوماتی خلاصہ اردو رسم الخط میں دو۔",
      },
      {
        id: "focus",
        label: "آج کے اہم کام",
        description: "کاروباری ترجیحات",
        prompt: "میرے کاروبار کے لیے آج کے تین اہم کام ترجیح کے ساتھ بتاؤ اور ہر کام کا اگلا قدم لکھو۔ جواب اردو رسم الخط میں دو۔",
      },
      {
        id: "command-center",
        label: "روزانہ کمانڈ سینٹر",
        description: "آج کا مکمل کاروباری خلاصہ",
        prompt: "میرے کاروبار کا روزانہ کمانڈ سینٹر بناؤ: آج کی اہم خبریں، pending کام، follow-up ترجیحات، meetings، ممکنہ risks اور اگلے تین actions ایک مختصر اردو بریفنگ میں دو۔ دستیاب معلومات نہ ہوں تو واضح طور پر سوال پوچھو۔",
      },
    ];
  }

  return [
    {
      id: "saudi-sme",
      label: "Saudi SME briefing",
      description: "Business news, updates and actions",
      prompt: "Give me a concise briefing for Saudi small and medium businesses: important business news, official or regulatory updates, possible opportunities or risks, and three practical actions for today. Clearly state when information is unavailable. Reply only in clear English; do not use Hindi, Devanagari, or Roman Urdu.",
    },
    {
      id: "whatsapp",
      label: "WhatsApp business draft",
      description: "Customer or supplier message",
      prompt: "Draft a short, clear, polite WhatsApp message for my customer or supplier in my selected language. Ask for the purpose and tone if details are missing. Do not send anything; provide only a draft for approval.",
    },
    {
      id: "quote",
      label: "Quote or invoice draft",
      description: "Professional pricing document",
      prompt: "Create a professional quotation or invoice draft for my business. Organize item, quantity, price, VAT, delivery, payment terms and validity in a clear table. Ask questions before drafting if information is missing.",
    },
    {
      id: "meeting",
      label: "Meeting summary",
      description: "Decisions and action items",
      prompt: "Summarize my meeting notes or transcript. Separate decisions, owners, deadlines, risks and next actions. If no notes are provided, ask me to paste them.",
    },
    {
      id: "complaint",
      label: "Complaint reply",
      description: "Empathetic professional draft",
      prompt: "Draft an empathetic, concise and professional reply to a customer complaint in my selected language. Acknowledge the issue, explain the next step, and do not promise anything uncertain. Do not send it; provide a draft for approval.",
    },
    {
      id: "sales",
      label: "Sales follow-up",
      description: "Priorities and message drafts",
      prompt: "Organize my sales follow-up work for today. For each customer, provide priority, next action and a short message draft in my selected language. Ask me for the customer list if it is missing.",
    },
    {
      id: "expense",
      label: "Expense categorizer",
      description: "Organize business spending",
      prompt: "Categorize my expenses into rent, payroll, delivery, marketing, supplies and other suitable categories, calculate totals, and flag unclear entries. Do not give financial advice; provide an organized summary.",
    },
    {
      id: "compliance",
      label: "Compliance reminders",
      description: "ZATCA and business deadlines",
      prompt: "Create a reminder checklist for my Saudi business covering relevant ZATCA, VAT, Commercial Registration and license renewals. Use current reliable sources for dates or rules, clearly mark uncertainty, and do not present it as legal advice.",
    },
    {
      id: "translate",
      label: "Business translation",
      description: "Understand Arabic, reply in Urdu or English",
      prompt: "Explain the meaning of the Arabic business message I provide, then draft an appropriate reply in clear Urdu or English. Do not use Hindi, Devanagari, or Roman Urdu.",
    },
    {
      id: "document",
      label: "Document review",
      description: "Key terms, risks and actions",
      prompt: "Review the attached or provided business document and extract key terms, amounts, dates, responsibilities, risks and next actions. Do not make a legal decision; provide an informational summary in my selected language.",
    },
    {
      id: "focus",
      label: "Today's priorities",
      description: "Prioritize business work",
      prompt: "Give me the three most important tasks for my business today, in priority order, with the next step for each.",
    },
    {
      id: "command-center",
      label: "Daily command center",
      description: "One business briefing for today",
      prompt: "Create my daily business command center: important news, pending work, follow-up priorities, meetings, possible risks and the next three actions in one concise briefing. Ask clear questions when required information is unavailable.",
    },
  ];
}

const PRIMARY_SKILL_IDS = new Set(["saudi-sme", "whatsapp", "quote", "meeting", "complaint", "focus"]);

export function QuickSkills({ lang, onRun }: Props) {
  const [showMore, setShowMore] = useState(false);
  const skills = skillsFor(lang);
  const visibleSkills = showMore ? skills : skills.filter((skill) => PRIMARY_SKILL_IDS.has(skill.id));
  const moreLabel = lang === "ur" ? "مزید کام" : "More actions";

  return (
    <section className="relative z-10 mx-auto mt-2.5 w-[min(94vw,560px)]" aria-label={lang === "ur" ? "فوری کام" : "Quick skills"}>
      <div className="mb-1.5 flex items-center justify-between px-0.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">{lang === "ur" ? "فوری کام" : "Quick skills"}</span>
        <span className="text-[10px] text-white/30">{lang === "ur" ? "منظوری کے ساتھ" : "Approval required"}</span>
      </div>
      <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
        {visibleSkills.map((skill) => (
          <button
            key={skill.id}
            type="button"
            onClick={() => void onRun(skill.prompt)}
            className="group min-h-11 rounded-lg border border-white/10 bg-white/[0.035] px-2.5 py-2 text-left transition hover:border-cyan-300/30 hover:bg-cyan-300/[0.07] focus:outline-none focus:ring-2 focus:ring-cyan-300/40 sm:rounded-xl sm:px-3 sm:py-2.5"
          >
            <span className="block truncate text-[11px] font-medium text-white/80 group-hover:text-cyan-100 sm:text-xs">{skill.label}</span>
            <span className="mt-0.5 hidden text-[10px] leading-snug text-white/40 sm:block">{skill.description}</span>
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setShowMore((value) => !value)}
        aria-expanded={showMore}
        className="mt-1.5 min-h-11 w-full rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-[11px] text-white/55 transition hover:border-cyan-300/30 hover:text-cyan-100 focus:outline-none focus:ring-2 focus:ring-cyan-300/40 touch-manipulation"
      >
        {showMore ? (lang === "ur" ? "کم دکھائیں" : "Show less") : `${moreLabel} +${skills.length - PRIMARY_SKILL_IDS.size}`}
      </button>
    </section>
  );
}
