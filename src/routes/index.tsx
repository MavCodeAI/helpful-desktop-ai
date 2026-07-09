/**
 * License gate — the app's landing page.
 *
 * Purpose: block access to the JARVIS console until the user provides a
 * valid license key. Layout is a single centered card with an animated
 * "reactor" orb, matching the desktop-assistant aesthetic of the console.
 *
 * Flow:
 *   1. On mount, if a license is already saved in localStorage, redirect
 *      straight to /jarvis so returning users skip this screen.
 *   2. On submit, validate locally (mock) and either save + redirect or
 *      show a toast error.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { validateLicenseKey, saveLicense, getLicense } from "@/lib/license";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  component: LicenseGate,
  head: () => ({
    meta: [
      { title: "JARVIS — Desktop AI Assistant" },
      {
        name: "description",
        content:
          "Your personal voice-powered AI assistant. Enter your license key to activate JARVIS.",
      },
      { property: "og:title", content: "JARVIS — Desktop AI Assistant" },
      {
        property: "og:description",
        content: "Voice-powered AI assistant inspired by Tony Stark's JARVIS.",
      },
    ],
  }),
});

function LicenseGate() {
  const navigate = useNavigate();

  // Controlled input for the license field.
  const [key, setKey] = useState("");
  // Disables the submit button and shows "Verifying…" during the mock check.
  const [checking, setChecking] = useState(false);

  // If a license is already stored, skip the gate. Runs once on mount.
  useEffect(() => {
    if (getLicense()) navigate({ to: "/jarvis" });
  }, [navigate]);

  /**
   * Handle "Activate" click / Enter key.
   *
   * Deliberately awaits a small delay so the UI briefly shows a "verifying"
   * state — this makes the gate feel like a real server check rather than
   * an instant regex, without adding real latency for testers.
   */
  const activate = async () => {
    // Guard against double-submit (Enter spamming during the 400ms delay).
    if (checking) return;
    setChecking(true);
    try {
      await new Promise((r) => setTimeout(r, 400));
      if (!validateLicenseKey(key)) {
        toast.error("Invalid license key", {
          description: "Try JARVIS-DEMO-0001 to demo.",
        });
        return;
      }
      const persisted = saveLicense(key);
      if (!persisted) {
        // Storage failed — most likely private-browsing / quota. The user
        // can still proceed for this session; warn but don't block.
        toast.warning("Couldn't save license", {
          description: "You'll need to re-enter it next visit.",
        });
      } else {
        toast.success("License activated. Welcome.");
      }
      navigate({ to: "/jarvis" });
    } catch (e) {
      console.error("[activate] failed", e);
      toast.error("Something went wrong — please retry.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background halo — pure decoration, no interaction. */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-jarvis/10 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Brand mark: pulsing reactor + wordmark */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full border border-jarvis/40 jarvis-glow mb-6 relative">
            <div className="w-10 h-10 rounded-full bg-jarvis animate-[jarvis-pulse_2s_ease-in-out_infinite]" />
            {/* Expanding ring — one iteration each 2s. */}
            <span className="absolute inset-0 rounded-full border border-jarvis/60 animate-[jarvis-ring_2s_ease-out_infinite]" />
          </div>
          <h1 className="font-display text-5xl font-bold tracking-[0.2em] text-jarvis jarvis-text-glow">
            JARVIS
          </h1>
          <p className="mt-3 text-sm text-muted-foreground tracking-wider uppercase">
            Desktop AI Assistant
          </p>
        </div>

        {/* License form card */}
        <div className="rounded-xl border border-jarvis/20 bg-card/60 backdrop-blur-xl p-6 space-y-4">
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground">
              License Key
            </label>
            <Input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              // Enter key triggers submit for keyboard-first users.
              onKeyDown={(e) => e.key === "Enter" && activate()}
              placeholder="JARVIS-XXXX-XXXX"
              className="mt-2 font-mono text-center tracking-wider bg-input/50 border-jarvis/30 focus-visible:ring-jarvis"
              autoFocus
              maxLength={32}
              autoComplete="off"
              spellCheck={false}
              aria-label="License key"
            />
          </div>
          <Button
            onClick={activate}
            disabled={checking || !key.trim()}
            className="w-full bg-jarvis text-primary-foreground hover:bg-jarvis/90 font-semibold tracking-wider"
          >
            {checking ? "Verifying…" : "Activate"}
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            Demo key: <span className="font-mono text-jarvis">JARVIS-DEMO-0001</span>
          </p>
        </div>
      </div>
    </main>
  );
}
