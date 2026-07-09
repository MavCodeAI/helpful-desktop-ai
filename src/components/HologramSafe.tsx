import { Component, type ReactNode } from "react";
import { Hologram } from "./Hologram";

/**
 * Error boundary around the WebGL orb. If the browser has no WebGL,
 * context is lost, or shader compilation fails, fall back to a static
 * pulse so the JARVIS UI keeps its center of gravity.
 */
export class HologramSafe extends Component<
  { level?: number; children?: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(err: unknown) {
    console.warn("[HologramSafe] WebGL orb failed, using fallback:", err);
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="relative h-56 w-56">
            <div className="absolute inset-0 animate-pulse rounded-full bg-jarvis/20 blur-2xl" />
            <div className="absolute inset-6 animate-pulse rounded-full bg-jarvis/30 blur-xl" />
            <div className="absolute inset-14 rounded-full bg-jarvis/70 jarvis-glow" />
          </div>
        </div>
      );
    }
    return <Hologram level={this.props.level} />;
  }
}
