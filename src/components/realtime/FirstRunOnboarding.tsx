import { useEffect, useState } from "react";
import { ArrowRight, Check, KeyRound, Mic, Sparkles, X } from "lucide-react";
import type { LangCode } from "@/lib/persona";

type Props = {
  lang: LangCode;
  onOpenSettings: () => void;
  onRun: (text: string) => void | Promise<void>;
};

type OnboardingState = {
  step: number;
  dismissed: boolean;
};

const STORAGE_KEY = "alpha_onboarding_v2";
const DEFAULT_STATE: OnboardingState = { step: 0, dismissed: false };

function loadState(): OnboardingState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<OnboardingState> | null;
    return {
      step: Number.isInteger(parsed?.step) ? Math.max(0, Math.min(2, parsed!.step!)) : 0,
      dismissed: parsed?.dismissed === true,
    };
  } catch {
    return DEFAULT_STATE;
  }
}

function saveState(state: OnboardingState) {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* local-only storage may be unavailable */ }
}

export function FirstRunOnboarding({ lang, onOpenSettings, onRun }: Props) {
  const [state, setState] = useState<OnboardingState>(DEFAULT_STATE);
  const [visible, setVisible] = useState(false);
  const urdu = false;

  useEffect(() => {
    const next = loadState();
    setState(next);
    setVisible(!next.dismissed);
  }, []);

  if (!visible) return null;

  const setStep = (step: number) => {
    const next = { ...state, step, dismissed: false };
    setState(next);
    saveState(next);
  };

  const dismiss = () => {
    const next = { ...state, dismissed: true };
    setState(next);
    saveState(next);
    setVisible(false);
  };

  const steps = urdu
    ? [
        { icon: Sparkles, title: "Alpha سے ایک کام کروائیں", body: "آپ آواز یا text میں کام بتا سکتے ہیں۔ Alpha پہلے سمجھے گا، پھر خطرناک external action سے پہلے آپ سے اجازت لے گا۔" },
        { icon: KeyRound, title: "Alpha کو connect کریں", body: "Settings کھولیں، Gemini API key شامل کریں، پھر Save and test دبائیں۔ سیکیورٹی کے لیے یہ key صرف موجودہ session میں استعمال ہوگی۔" },
        { icon: Mic, title: "پہلا کام text سے آزمائیں", body: "پہلے کم خطرے والا task چلائیں۔ کامیابی کے بعد آپ voice input آزما سکتے ہیں۔" },
      ]
    : [
        { icon: Sparkles, title: "Give Alpha one useful task", body: "Tell Alpha what you need by voice or text. Alpha explains what it understood and asks before any external action." },
        { icon: KeyRound, title: "Connect Alpha once", body: "Open Settings, add your Gemini API key, then choose Save and test. For security, the key is used only for the current session." },
        { icon: Mic, title: "Run your first task by text", body: "Start with a safe task so you can see how Alpha works. You can try voice after your first result." },
      ];
  const current = steps[state.step];
  const Icon = current.icon;

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/65 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-label={urdu ? "Alpha کا آغاز" : "Get started with Alpha"}>
      <section className="w-full max-w-md rounded-3xl border border-cyan-300/20 bg-[#07131e]/95 p-5 shadow-2xl shadow-cyan-950/40 sm:p-7" dir="ltr">
        <div className="flex items-start justify-between gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-200 ring-1 ring-cyan-300/20"><Icon className="h-6 w-6" /></div>
          <button onClick={dismiss} className="grid min-h-11 min-w-11 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white touch-manipulation" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-6">
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-cyan-200/70">Alpha · {state.step + 1}/3</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">{current.title}</h2>
          <p className="mt-3 text-sm leading-7 text-white/65">{current.body}</p>
        </div>
        <div className="mt-6 flex gap-1.5" aria-label="Progress">
          {steps.map((_, index) => <span key={index} className={`h-1.5 flex-1 rounded-full ${index <= state.step ? "bg-cyan-300" : "bg-white/10"}`} />)}
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button onClick={dismiss} className="min-h-11 rounded-xl px-4 text-sm text-white/55 hover:bg-white/5 hover:text-white touch-manipulation">Skip for now</button>
          {state.step === 1 ? (
            <button onClick={() => { saveState({ step: 2, dismissed: true }); setState({ step: 2, dismissed: true }); setVisible(false); onOpenSettings(); }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-5 text-sm font-semibold text-slate-950 hover:bg-cyan-200 touch-manipulation"><KeyRound className="h-4 w-4" />Open connection settings</button>
          ) : state.step === 2 ? (
            <button onClick={() => { void onRun(lang === "ur" ? "آج کے اہم کاروباری کام بتاؤ" : "Give me today's top business priorities"); dismiss(); }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-5 text-sm font-semibold text-slate-950 hover:bg-cyan-200 touch-manipulation"><Check className="h-4 w-4" />Run first task by text</button>
          ) : (
            <button onClick={() => setStep(1)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-5 text-sm font-semibold text-slate-950 hover:bg-cyan-200 touch-manipulation"><ArrowRight className="h-4 w-4" />Get started</button>
          )}
        </div>
      </section>
    </div>
  );
}
