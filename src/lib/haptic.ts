/** Best-effort haptic feedback; silently no-ops where unsupported. */
export function haptic(ms = 10) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* not supported */
  }
}
