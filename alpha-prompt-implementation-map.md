# Alpha Prompt Implementation Map

## Product context

Alpha is a Saudi Arabia-first Windows/Android voice productivity SaaS for SMEs. The frontend UI is English-only. The AI and voice layer supports Urdu and English, with a strict no-Hindi and no-Roman-Urdu requirement. The primary user goal is to speak or type a useful business request, understand the result, and safely approve any external action such as a WhatsApp or email handoff.

## Prompts selected for execution

| Prompt pack item | Alpha application | Priority | Execution decision |
|---|---|---:|---|
| 1. Comprehensive UI/UX Audit | Re-audit real routes and components, not generic screenshots | P0 | Execute against onboarding, MainStage, API setup, Settings Drawer, Dashboard, Business Profile, Reminders, ActionsList and ChatComposer |
| 2. Beginner Usability Audit | Verify a clean first visit and the first successful task | P0 | Execute; this is the core activation journey |
| 3. Complete User-Journey Audit | Map connect → try → result → approve/open → recovery | P0 | Execute; define measurable success criteria |
| 4. Mobile UX Audit | Check 320, 375, 390 and 428px behavior plus keyboard/back/scrolling | P0 | Execute where browser automation permits; mark physical-device items as manual |
| 5. Accessibility Audit | Focus, labels, keyboard, contrast, status announcements, reflow and touch targets | P0 | Execute; distinguish code-confirmed from assistive-technology/manual findings |
| 7. Interaction-State Audit | Loading, success, error, empty, offline, permission and expired-session states | P0 | Execute across primary task and settings/forms |
| 8. Forms and Validation Audit | API key, profile and reminder forms; preserve drafts and explain errors | P0 | Execute |
| 9. Information Architecture Audit | Navigation naming, current location, back behavior and Advanced disclosure | P1 | Execute |
| 10. Empty/Error/Loading Audit | Recovery microcopy and next actions | P0 | Execute |
| 11. Conversion and Trust Audit | Explain value, privacy, approvals, send semantics and setup effort | P1 | Execute without deceptive patterns |
| 12. Design-System Consistency Audit | Shared button, badge, form, sidebar, focus and spacing primitives | P1 | Execute systemically |
| 13. AI Coding-Agent Remediation | Small coherent implementation changes with verification | P0 | Use as implementation protocol |
| 14. Prioritization Prompt | Rank findings by impact, effort, abandonment risk and dependency risk | P0 | Use for sequencing |
| 15. Final Quality-Control Prompt | Compare findings against current implementation after changes | P0 | Execute before release |
| Recommended Master Prompt | Consolidated acceptance checklist | P0 | Use as final report structure |

## Prompts intentionally not treated as separate implementation work

Prompt 6 (visual hierarchy) is folded into the beginner and journey audits because visual changes matter only when they improve comprehension or task completion. Prompt 3 and the recommended master prompt overlap, so they will produce one journey table rather than duplicate reports. Prompt 13 is a method, not a product feature. Prompt 14 is a prioritization framework, not a user-facing prompt.

## Acceptance constraints

The implementation must keep the UI English-only, preserve Urdu/English AI and voice behavior, never introduce Hindi or Roman Urdu, maintain mandatory approval before external actions, preserve user drafts after failed requests, use 44px minimum touch targets where practical, and avoid storing raw API keys in persistent browser storage. Every claimed fix must be verified by source inspection plus lint/build/tests, and physical Android-only findings must be labelled as manual QA rather than falsely marked complete.

## Target primary journey

A new user should be able to open Alpha, understand its purpose, connect Gemini with one clear action, run one safe text-first task, see a readable result, then use voice and approve an external WhatsApp/email handoff with a complete preview and explicit next step. The journey should recover from invalid keys, offline state, denied microphone permission, failed requests, cancellation and back navigation without losing work.

## Execution order

1. Re-audit the primary journey and high-risk states.
2. Fix blockers affecting first-task completion, trust, draft preservation, mobile navigation and accessibility.
3. Consolidate shared state and design-system fixes.
4. Run responsive and regression validation.
5. Produce a resolved/partial/unresolved matrix and release checklist.

## Findings classification

Each finding will be labelled as **Observed**, **Inferred risk**, or **Manual validation required**. No visual-only recommendation will be elevated above a task-completion, safety, accessibility, persistence or recovery issue.

## Explicit non-goals

This pass will not add arbitrary prompt suggestions, hidden automation that sends external messages without approval, unsupported subscription/payment claims, Hindi or Roman Urdu content, or a public sitemap for authenticated app routes.
