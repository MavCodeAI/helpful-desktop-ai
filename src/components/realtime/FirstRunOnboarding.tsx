import { useEffect, useState } from "react";
import { ArrowRight, Check, KeyRound, Mic, Sparkles, X } from "lucide-react";
import type { LangCode } from "@/lib/persona";

type Props = {
  lang: LangCode;
  onOpenSettings: () => void;
  onRun: (text: string) => void | Promise<void>;
};

const STORAGE_KEY = "alpha_onboarding_complete_v1";

export function FirstRunOnboarding({ lang, onOpenSettings, onRun }: Props) {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    setVisible(localStorage.getItem(STORAGE_KEY) !== "1");
  }, []);

  if (!visible) return null;

  const urdu = lang === "ur";
  const finish = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  };

  const steps = urdu
    ? [
        { icon: Sparkles, title: "Alpha میں خوش آمدید", body: "اپنی آواز یا text کے ذریعے روزمرہ کاروباری کام تیزی سے مکمل کریں۔ ہر risky action آپ کی منظوری کے بعد ہی ہوگا۔" },
        { icon: KeyRound, title: "اپنی AI key لگائیں", body: "Settings کھولیں، Gemini API key شامل کریں اور Apply & Test دبائیں۔ key اسی device پر local settings میں محفوظ رہتی ہے۔" },
        { icon: Mic, title: "پہلا کام آزمائیں", body: "مثلاً کہیں: آج کے اہم کاروباری کام بتاؤ۔ Alpha آپ کے لیے briefing تیار کرے گا۔" },
      ]
    : [
        { icon: Sparkles, title: "Welcome to Alpha", body: "Complete daily business work by voice or text. Risky actions always wait for your approval." },
        { icon: KeyRound, title: "Connect your AI", body: "Open Settings, add your Gemini API key, then press Apply & Test. Your key stays in this device's local settings." },
        { icon: Mic, title: "Try your first task", body: "Say or type: Give me today's top business priorities. Alpha will prepare a useful briefing." },
      ];
  const current = steps[step];
  const Icon = current.icon;

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/65 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-label={urdu ? "Alpha کا آغاز" : "Get started with Alpha"}>
      <section className="w-full max-w-md rounded-3xl border border-cyan-300/20 bg-[#07131e]/95 p-5 shadow-2xl shadow-cyan-950/40 sm:p-7" dir={urdu ? "rtl" : "ltr"}>
        <div className="flex items-start justify-between gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-200 ring-1 ring-cyan-300/20"><Icon className="h-6 w-6" /></div>
          <button onClick={finish} className="grid min-h-11 min-w-11 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white touch-manipulation" aria-label={urdu ? "بند کریں" : "Close"}><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-6">
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-cyan-200/70">Alpha · {step + 1}/3</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">{current.title}</h2>
          <p className="mt-3 text-sm leading-7 text-white/65">{current.body}</p>
        </div>
        <div className="mt-6 flex gap-1.5" aria-label={urdu ? "پیش رفت" : "Progress"}>
          {steps.map((_, index) => <span key={index} className={`h-1.5 flex-1 rounded-full ${index <= step ? "bg-cyan-300" : "bg-white/10"}`} />)}
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <button onClick={finish} className="min-h-11 rounded-xl px-4 text-sm text-white/55 hover:bg-white/5 hover:text-white touch-manipulation">{urdu ? "بعد میں" : "Skip for now"}</button>
          {step === 1 ? (
            <button onClick={() => { setVisible(false); onOpenSettings(); setStep(2); }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-5 text-sm font-semibold text-slate-950 hover:bg-cyan-200 touch-manipulation"><KeyRound className="h-4 w-4" />{urdu ? "Settings کھولیں" : "Open Settings"}</button>
          ) : step === 2 ? (
            <button onClick={() => { void onRun(urdu ? "آج کے اہم کاروباری کام بتاؤ" : "Give me today's top business priorities"); finish(); }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-5 text-sm font-semibold text-slate-950 hover:bg-cyan-200 touch-manipulation"><Check className="h-4 w-4" />{urdu ? "پہلا کام چلائیں" : "Run first task"}</button>
          ) : (
            <button onClick={() => setStep(1)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-5 text-sm font-semibold text-slate-950 hover:bg-cyan-200 touch-manipulation"><ArrowRight className="h-4 w-4" />{urdu ? "شروع کریں" : "Get started"}</button>
          )}
        </div>
      </section>
    </div>
  );
}
