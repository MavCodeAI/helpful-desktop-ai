import { useEffect, useState } from "react";
import { Monitor, Download, Keyboard, CheckCircle2 } from "lucide-react";
import { isElectron, electronPlatform, getAutoLaunch, setAutoLaunch } from "@/lib/electron-bridge";
import { HOTKEY_LABEL } from "@/lib/realtime/constants";

interface Props {
  confirmBeforeOpen: boolean;
  toggleConfirmBeforeOpen: (v: boolean) => void;
  desktopAutoLaunch: boolean;
  toggleDesktopAutoLaunch: (v: boolean) => void;
}

export function DesktopSection({
  confirmBeforeOpen, toggleConfirmBeforeOpen,
  desktopAutoLaunch, toggleDesktopAutoLaunch,
}: Props) {
  const electron = isElectron();
  const platform = electronPlatform();
  const [autoLaunchState, setAutoLaunchState] = useState(desktopAutoLaunch);

  useEffect(() => {
    if (!electron) return;
    getAutoLaunch().then(setAutoLaunchState);
  }, [electron]);

  const onToggleAutoLaunch = async (v: boolean) => {
    setAutoLaunchState(v);
    toggleDesktopAutoLaunch(v);
    if (electron) await setAutoLaunch(v);
  };

  return (
    <section>
      <h3 className="text-[10px] uppercase tracking-[0.2em] text-cyan-300/80 font-semibold mb-2 flex items-center gap-2">
        <Monitor className="w-3 h-3" /> Desktop
      </h3>

      {electron ? (
        <div className="glass-item rounded-md px-3 py-2 mb-2 text-xs text-emerald-300/90 flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>Running as desktop app · {platform}</span>
        </div>
      ) : (
        <div className="glass-item rounded-md px-3 py-2 mb-2 text-[11px] text-white/70 leading-relaxed">
          <div className="flex items-center gap-2 text-cyan-300/90 mb-1">
            <Download className="w-3.5 h-3.5" />
            <span className="font-semibold">Desktop app available</span>
          </div>
          <p>
            Package Alpha as a native desktop app with tray icon, global hotkey,
            and native notifications. See <code className="text-cyan-200">electron/README.md</code> for build steps:
          </p>
          <pre className="mt-1.5 text-[10px] bg-black/30 p-1.5 rounded overflow-x-auto text-cyan-200/80">
{`npm install --save-dev electron @electron/packager
npm run electron:package`}
          </pre>
        </div>
      )}

      <label className="glass-item flex items-center justify-between gap-3 px-3 py-2 rounded-md cursor-pointer">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-white/90">Confirm before opening</div>
          <div className="text-[10px] text-white/60 mt-0.5">Ask before launching apps or URLs</div>
        </div>
        <input
          type="checkbox"
          checked={confirmBeforeOpen}
          onChange={(e) => toggleConfirmBeforeOpen(e.target.checked)}
          className="shrink-0 h-4 w-4 accent-cyan-400"
        />
      </label>

      <label className={`glass-item flex items-center justify-between gap-3 px-3 py-2 rounded-md mt-1.5 ${electron ? "cursor-pointer" : "opacity-50 cursor-not-allowed"}`}>
        <div className="min-w-0">
          <div className="text-xs font-semibold text-white/90">Auto-launch on login</div>
          <div className="text-[10px] text-white/60 mt-0.5">
            {electron ? "Start Alpha when you log in" : "Desktop app only"}
          </div>
        </div>
        <input
          type="checkbox"
          disabled={!electron}
          checked={autoLaunchState}
          onChange={(e) => onToggleAutoLaunch(e.target.checked)}
          className="shrink-0 h-4 w-4 accent-cyan-400"
        />
      </label>

      <div className="mt-2 flex items-center gap-1.5 text-[10px] text-white/55">
        <Keyboard className="w-3 h-3" />
        <span>Global hotkey: <span className="text-cyan-300">{HOTKEY_LABEL}</span></span>
      </div>
    </section>
  );
}
