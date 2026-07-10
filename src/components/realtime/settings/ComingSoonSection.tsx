import { Lock, Home, Lightbulb, Thermometer, Tv } from "lucide-react";

function Row({ icon: Icon, label }: { icon: typeof Home; label: string }) {
  return (
    <div className="glass-item flex items-center justify-between gap-3 px-3 py-2 rounded-md opacity-70">
      <div className="flex items-center gap-2 min-w-0">
        <Icon className="w-3.5 h-3.5 text-white/60 shrink-0" />
        <span className="text-xs text-white/85 truncate">{label}</span>
      </div>
      <span className="flex items-center gap-1 text-[9px] uppercase tracking-widest text-amber-300/80 shrink-0">
        <Lock className="w-2.5 h-2.5" /> Soon
      </span>
    </div>
  );
}

export function ComingSoonSection() {
  return (
    <section>
      <h3 className="text-[10px] uppercase tracking-[0.2em] text-cyan-300/80 font-semibold mb-2 flex items-center gap-2">
        <Home className="w-3 h-3" /> Coming Soon
      </h3>
      <p className="text-[10px] text-white/55 mb-2 leading-relaxed">
        Home automation & smart-device control will arrive in a future update.
      </p>
      <div className="space-y-1.5">
        <Row icon={Lightbulb} label="Smart lights (on/off, dim)" />
        <Row icon={Thermometer} label="Thermostat & AC control" />
        <Row icon={Tv} label="TV, speakers & scenes" />
        <Row icon={Home} label="Routines (Good Morning, Away…)" />
      </div>
    </section>
  );
}
