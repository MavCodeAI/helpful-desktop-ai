# Alpha Minimalist UI/UX Simplification Review

## Primary user and goal

Alpha serves Saudi SME owners and staff who want to speak or type one useful business request in English or Urdu, receive a clear result, and safely approve any external WhatsApp or email handoff. The product should prove value before exposing advanced configuration.

## Classification of current surfaces

| Surface | Decision | Reason and action |
|---|---|---|
| `/` MainStage | **Keep** | This is the only essential work surface. It should remain the default landing page and show one primary action: type or speak a request. |
| First-run onboarding | **Simplify** | Keep to three steps: what Alpha does, connect Gemini, try one safe text task. Do not add feature tours or configuration before the first result. |
| Voice state label/orb | **Keep** | Essential trust and accessibility feedback. Keep the label, but do not expose technical latency or provider jargon in the primary view. |
| Text chat composer | **Keep** | Required fallback and the safest first-task path. Preserve drafts after failures and make retry/edit inline. |
| External action approval card | **Keep** | Security-critical. It must remain inline and show action, destination, content preview, and the external-app next step. |
| `/api-settings` | **Merge** | Treat as the detailed view opened from onboarding or Settings. Do not expose it as a primary navigation destination. The simple Save and test action remains in context; diagnostics stay Advanced. |
| Settings Drawer | **Simplify** | Keep connection, voice, microphone, language, and region visible. Keep performance, triggers, persona, memory, briefing, theme, privacy, danger, and experimental controls under Advanced. |
| `/dashboard` | **Merge** | Keep the useful priority card, reminders summary, and recent actions, but treat Dashboard as a secondary “Business” view reachable from the main surface—not a competing home. |
| `/business-profile` | **Merge** | Keep profile and recurring reminders in one Business setup flow. Do not require the user to visit a separate profile page before trying Alpha. |
| `/memories` | **Hide** | Useful for advanced users but not part of activation. Keep it accessible through Settings → Advanced → Memory. |
| Notes drawer | **Simplify** | Keep AI note creation as a contextual action after a result. Do not present notes as a competing primary workflow. |
| History drawer | **Keep, secondary** | Important for recovery and trust, but it should be an icon/overflow action from MainStage rather than a top-level destination. |
| Timers/reminders bar | **Simplify** | Show only active items. Empty state should be absent rather than a large empty dashboard block. Management belongs in Business setup. |
| Quick skills | **Simplify** | Show at most three safe, high-value examples: WhatsApp draft, email draft, and daily briefing. Put the rest behind “More examples” or remove them until usage data proves value. |
| Provider/model diagnostics | **Hide** | Advanced-only. Ordinary users need “Connected” or a human error with a retry action, not provider internals. |
| Coming Soon section | **Delete from primary settings** | It creates expectation without current value. Move future roadmap content outside the working settings surface. |
| Theme selection | **Hide** | Keep only if the app supports a real user need; otherwise retain the system/default theme and avoid another decision during setup. |
| Wake clap/word/hotkey and desktop auto-launch | **Hide** | Desktop power-user controls; place under Advanced and never show during first run. |

## Recommended simplified sitemap

```text
MainStage (default)
├── Inline onboarding (first visit only)
├── Inline chat/voice task
├── Inline action approval and result recovery
├── History drawer
├── Notes drawer (contextual)
└── Settings drawer
    ├── Connection
    ├── Voice and microphone
    ├── Language and region
    ├── Business setup → profile + reminders
    └── Advanced
        ├── API diagnostics
        ├── Performance and triggers
        ├── Persona and memory
        ├── Briefing and theme
        ├── Privacy
        └── Danger zone
```

## Delete immediately

Remove or suppress the `Coming Soon` settings section from the working product. Do not delete security, privacy, recovery, approval, history, or destructive confirmation flows merely because they are infrequently used.

## Merge

Use MainStage as the product home, with API setup, Business Profile, and reminders treated as contextual flows. Keep their URLs for deep links and recovery, but do not make them compete in primary navigation.

## Hide under Advanced

Hide provider/model diagnostics, triggers, desktop auto-launch, wake controls, custom persona prompt, memory management, briefing configuration, theme choices, and danger controls. These features remain available to users who intentionally seek them.

## Simplification acceptance criteria

A new user must be able to understand Alpha, connect Gemini, run one text task, read the result, and recover from failure without opening Dashboard, Business Profile, Memories, or detailed API documentation. No essential security, privacy, approval, error, offline, undo, or account-recovery state may be removed.

## Implementation order

First remove non-functional roadmap content from the primary settings surface and correct contradictory key-storage copy. Next reduce visible quick skills and keep secondary routes contextual. Finally validate the simplified flow with first-task completion, failed-request recovery, denied microphone permission, external-action cancellation, back navigation, and 320–428px mobile widths.

## Validation-required decisions

Analytics or user research should decide whether AI Notes, Briefing, custom Persona, and Memories produce enough repeated value to remain in Advanced. They should not be deleted solely because they are not part of activation.

> Minimalism here means fewer decisions before the first useful result—not fewer safety, accessibility, recovery, or trust mechanisms.
