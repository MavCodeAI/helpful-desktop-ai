import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { Keyboard, KeyboardResize } from "@capacitor/keyboard";
import { StatusBar, Style } from "@capacitor/status-bar";

type Dispose = () => void;

export function isCapacitorNative(): boolean {
  return Capacitor.isNativePlatform();
}

export function isCapacitorAndroid(): boolean {
  return Capacitor.getPlatform() === "android";
}

/** Configure native-only chrome without breaking browser or Electron builds. */
export async function configureCapacitorShell(): Promise<void> {
  if (!isCapacitorNative()) return;

  await Promise.allSettled([
    StatusBar.setStyle({ style: Style.Dark }),
    StatusBar.setBackgroundColor({ color: "#0b0d12" }),
    Keyboard.setResizeMode({ mode: KeyboardResize.Body }),
  ]);
}

/** Stop realtime microphone sessions when Android sends the Activity to background. */
export async function listenForCapacitorAppState(
  onActiveChange: (isActive: boolean) => void,
): Promise<Dispose> {
  if (!isCapacitorNative()) return () => {};
  const handle = await App.addListener("appStateChange", ({ isActive }) => {
    onActiveChange(isActive);
  });
  return () => {
    void handle.remove();
  };
}

export function hapticLight(): void {
  if (!isCapacitorNative()) return;
  void Haptics.impact({ style: ImpactStyle.Light });
}

export function hapticSuccess(): void {
  if (!isCapacitorNative()) return;
  void Haptics.notification({ type: NotificationType.Success });
}

export function hapticError(): void {
  if (!isCapacitorNative()) return;
  void Haptics.notification({ type: NotificationType.Error });
}
