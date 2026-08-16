# Alpha: Ruthless End-to-End UX Audit

**Scope:** First-time user journey from first launch to a successfully completed voice-to-action, with text fallback, API setup, approval, business profile, reminders, dashboard, recovery, and mobile behavior included.

**Product lens:** Saudi SME productivity assistant for Windows and Android. The target user is assumed to be non-technical, unfamiliar with AI assistants, and using a phone one-handed. The frontend is English-only; the assistant may speak and write Urdu or English, with Hindi and Roman Urdu prohibited.

## Executive verdict

Alpha currently has the ingredients of a useful assistant, but the journey is still designed like a collection of capable developer surfaces rather than a single beginner-safe product. The largest problem is not visual polish. It is **decision overload and unclear state ownership**: the user is repeatedly asked to understand providers, keys, models, voice states, settings sections, actions, approvals, reminders, and drawers before they have experienced one successful outcome.

The product’s primary promise should be: **“Tell Alpha one useful thing, see what it understood, approve anything external, and know exactly when it is done.”** The current flow instead makes the user discover how to configure the product before the product demonstrates value. This is especially risky on mobile, where the main surface, multiple drawers, long settings scroll, and small secondary controls compete for attention.

The highest-impact redesign is to introduce one guided path with a single first task, defer all nonessential configuration, and make every state explicit: **Not ready → Ready → Listening → Understanding → Needs approval → Working → Done / Failed with retry.**

## 1. Real journey map

| Stage | Current implementation | Beginner’s likely question | Primary risk |
|---|---|---|---|
| 1. First launch | `FirstRunOnboarding` modal appears over the main voice surface | “What can this do for me, and do I need to configure it first?” | The user sees a three-step explanation before experiencing value. |
| 2. AI connection | Onboarding sends the user to Settings; a dedicated `/api-settings` route also exists | “Which settings screen is the real setup?” | Duplicate setup surfaces and technical API terminology. |
| 3. Key setup | Paste key, Save, Detect models, select models, Test | “Is Save enough? Why do I need Detect? Which model do I choose?” | Unnecessary technical work before first success. |
| 4. Return to app | User closes settings/drawer and returns to a dense home screen | “What should I do now?” | Setup completion is not converted into one obvious next action. |
| 5. First task | User can tap orb, type in composer, use Quick Skills, or use onboarding CTA | “Which input method is the correct one?” | Four competing starting points. |
| 6. Voice permission | Browser/Android microphone permission appears after pressing the orb | “Why is permission appearing now, and did Alpha start?” | Permission is a prerequisite but is presented as a failure-like interruption. |
| 7. Listening/processing | Orb, status label, partial transcript, latency chips, HUD | “Is Alpha listening, thinking, or stuck?” | Multiple indicators communicate state with different visual priorities. |
| 8. External action | `ActionsList` shows approval card with Approve/Cancel | “What exactly will happen if I approve?” | The payload, destination, side effects, and editability are not explicit enough. |
| 9. Completion | Action may open external link; action history shows `opened ✓` | “Was my email sent, drafted, or merely opened?” | Opened is not the same as completed. |
| 10. Business context | Dashboard points to Business Profile | “Do I need this now or later?” | Profile is treated as a separate form rather than progressive setup. |
| 11. Reminders | Profile page combines profile form and reminder creation/list | “Am I editing the business or managing tasks?” | Two different jobs are merged into one long screen. |
| 12. Recovery/repeat use | History, Chat, Notes, Settings, Dashboard, drawers | “Where do I return for my normal daily work?” | Navigation is feature-oriented instead of job-oriented. |

## 2. Critical and high-severity usability issues

| ID | Exact problem | Why it hurts the user | Severity | Recommended UX solution | Specific UI/flow change required |
|---|---|---|---|---|---|
| C-01 | The product requires the user to understand API keys before seeing value. | A non-technical SME owner may abandon before the first useful result. “AI assistant” becomes “developer setup.” | **Critical** | Separate **first value** from **advanced connection**. Use a server-managed/demo capability, or explain clearly that a key is required and guide the user through one minimal field only. | Replace the three-step API/model flow with a single “Connect Alpha” step: key field, show/hide, “Test and continue.” Hide provider/model controls under “Advanced.” |
| C-02 | There are two setup surfaces: the long Settings Drawer API section and dedicated `/api-settings`. | Users cannot know which screen is authoritative. They may save in one place and test in another, then assume the app is broken. | **Critical** | Create one canonical setup route. All other entry points should deep-link to that route and show the same connection status. | Remove the full API form from the long Settings Drawer. Keep a compact status row: “Gemini connected / Fix connection,” linking to `/api-settings`. |
| C-03 | Onboarding progress is not persisted until the user finishes or skips. Opening Settings hides the modal in the current session but does not mark onboarding complete. | Closing the app during setup can make the user repeat the onboarding. Returning users may see an onboarding modal again despite having configured the product. | **Critical** | Persist the current onboarding step and distinguish “pause setup” from “skip permanently.” | Store `{step, dismissed, completed}` in local storage. On returning, resume at “Test your connection” rather than restarting at step one. |
| C-04 | The onboarding’s “Try your first task” runs a text prompt but is presented as if the user is trying voice. | The user may believe microphone setup worked when only text execution occurred, or may not understand why no voice permission appeared. | **High** | Label the action honestly and offer one explicit choice: “Try by voice” or “Try by text.” | Change CTA to “Try this by voice” if it opens the orb/listening flow, with a secondary “Use text instead.” Do not call a text dispatch a voice test. |
| C-05 | The first home screen presents orb, Quick Skills, Chat, Notes, History, Settings, HUD, status, and actions simultaneously. | A first-time user cannot identify the primary action. Feature discovery becomes a visual scavenger hunt. | **Critical** | Establish one dominant first action and defer secondary tools until after the first success. | First-run home should show: greeting, one sentence, one primary “Hold to speak / Tap to speak” CTA, one text fallback, and at most three example tasks. Hide HUD, latency, Quick Skills, Notes, and advanced counts initially. |
| C-06 | The input model is ambiguous: orb, inline composer, Chat drawer, Quick Skills, and dashboard Quick Actions can all start work. | Users hesitate because there is no canonical way to begin. The same task may behave differently depending on entry point. | **High** | Use one universal composer with voice and text controls. Other surfaces should prefill that composer, not create parallel workflows. | Make `ChatComposer` the single task entry. The orb becomes its voice button. Quick Skills only populate the composer and focus it. Dashboard links return to the same composer with a visible draft. |
| C-07 | API setup uses “Provider,” “Detect,” “Available models,” model selection, and per-model “Test.” | These are developer terms and decisions that do not map to the user’s job. Selecting up to six models is unnecessary for a first use. | **High** | Use task language and smart defaults. | Default to Gemini and one tested model. Rename “Detect” to “Check connection.” Move model discovery and multi-model selection into an Advanced accordion. |
| C-08 | Saving the key and testing the connection are separate actions with no clear setup state machine. | The user may save successfully but still be unable to run Alpha, or test successfully without understanding whether the key was saved. | **High** | Combine save + test into one transactional action with explicit stages. | Use one CTA: “Save and test connection.” Show inline progress: “Saving locally → Checking Gemini → Ready.” After success, show “Alpha is ready” and a primary “Run your first task.” |
| C-09 | Failed model detection mostly uses toast errors, and an empty model result has no clear inline empty state. | Toasts disappear, are easy to miss on mobile, and do not tell the user what to do next. | **High** | Errors belong next to the failed action and must include a recovery action. | When no models are found, show an inline card: “No models found. Check the key or continue with the default Gemini model,” with “Retry” and “Use default.” |
| C-10 | Approval card does not provide an adequate human-readable preview of the proposed action. It shows a label and possibly a URL, then Approve/Cancel. | Users cannot safely verify recipient, message, destination, or whether the action is draft/open/send. Approval becomes a blind trust decision. | **Critical** | Make approval a review step, not a permission checkbox. | Show action type, target app, recipient/destination, exact content or a safe preview, side effects, and whether anything will be sent. Add “Edit before approval” where possible. Use CTAs “Approve and open,” “Edit,” and “Cancel.” |
| C-11 | “Auto-open” appears next to action history while approval is supposed to be mandatory. | Users may interpret it as permission to bypass approval or may enable a behavior they do not understand. | **High** | Remove or rename the control based on its real semantics. | Replace with a clear preference such as “Open approved links automatically,” default off, with helper text: “Approval is always required; this only controls what happens after approval.” |
| C-12 | Action completion is represented as `opened ✓`, which does not distinguish opened, drafted, sent, failed, or cancelled. | For business workflows, “opened WhatsApp” is not “message sent.” The user may believe a task is complete when it is not. | **Critical** | Define a precise action lifecycle and expose it consistently. | Use statuses: `Awaiting approval`, `Approved`, `Opened`, `Draft ready`, `Sent`, `Failed`, `Cancelled`. After external handoff, show “Alpha opened WhatsApp. You still need to press Send.” |
| C-13 | Text chat inserts the user’s message before the AI request completes; on failure it only shows a toast and removes no user message. | The conversation can look as though Alpha accepted a request when it actually failed. The user has no inline retry and may repeat the action. | **High** | Model request state in the conversation itself. | Add an assistant error bubble attached to the failed request with “Retry” and “Edit.” Mark the user message as “Not completed” or queue it until the response is accepted. |
| C-14 | Microphone permission appears only after pressing the orb, and the denied state instructs the user to open browser/site settings. | On Android this is a context switch at the moment of intent. Users may not know whether to return, reload, or try again. | **High** | Explain permission before requesting it and provide an in-app recovery sequence. | Before the system prompt, show a short permission sheet: why the mic is needed, “Allow microphone,” and “Use text instead.” After denial, show “Open microphone settings,” “Try again,” and “Continue with text.” |
| C-15 | Voice state is distributed across orb, HUD, `VoiceStateLabel`, status pill, partial transcript, latency chips, and error card. | More indicators do not equal more clarity. On a phone, the user may look at the wrong indicator and assume the app is stuck. | **High** | One authoritative state indicator, with secondary diagnostics hidden. | Make the state label and transcript the primary feedback. Collapse latency/STT/TTS into “Technical details.” Use one status sentence such as “Listening…,” “Understanding…,” “Speaking…,” or “Ready for your next task.” |
| C-16 | The Settings Drawer exposes provider, voice, mic, performance, wake triggers, persona, language, region, memory, briefing, privacy, theme, APIs, danger, and coming-soon sections in one scroll. | This is a configuration wall. A beginner cannot distinguish required setup from optional tuning, and mobile users must scroll through unrelated sections. | **Critical** | Reorganize by user goal and progressively disclose advanced controls. | Replace the single long drawer with a Settings landing list: `Connection`, `Voice`, `Language & region`, `Business context`, `Notifications`, `Privacy`, `Advanced`. Each opens a focused page or nested panel. |
| C-17 | Settings contains both AI provider/key configuration and voice preferences, but no obvious “Ready/Not ready” summary at the top. | Users must infer health from a small provider section rather than seeing whether the product can perform the main task. | **High** | Put readiness first. | Add a sticky top status card: “Alpha is ready” or “Action needed: connect Gemini,” with one CTA. |
| C-18 | Business Profile combines profile editing and reminder creation/list management in one screen. | These are different jobs with different mental models. The form becomes longer and harder to complete on mobile. | **High** | Split the information architecture while preserving a simple path. | Keep a short `Business context` form and move reminders to a separate `Reminders` screen. On first setup, ask only business name, industry, city, and tone. Defer VAT and working hours. |
| C-19 | Business Profile has no dirty-state warning or leave confirmation. Save is manual, but Back is always available. | Users can type several fields, press Back accidentally, and lose all changes with no warning. | **High** | Detect unsaved changes and make save state explicit. | Track `isDirty`; show a sticky mobile footer with `Save changes` and `Cancel`. If leaving dirty, show “Save changes before leaving?” with Save, Discard, and Stay. |
| C-20 | Required business-name validation is visible immediately, before the user has attempted submission. | The form looks invalid on first render and creates unnecessary visual pressure. | **Medium** | Validate on blur or submit, not immediately. | Hide the error until the field is touched or Save is pressed. Add a single summary message at the top after failed submission. |
| C-21 | Reminder creation requires title, date, category, repeat, and notes all at once; the form does not explain why each field matters. | A quick reminder becomes a multi-field data-entry task. Mobile users must scan several controls and may not know the difference between due date and repeat. | **High** | Start with the smallest valid reminder and reveal optional controls after the core fields. | First row: “What do you need to remember?” and “When?” Then an “Add details” disclosure for category, repeat, and notes. Use smart defaults: category Other, repeat Once. |
| C-22 | Reminder delete has no confirmation, and the completion control is visually 16px despite the 44px touch-target requirement. | Accidental deletion or missed taps are likely, especially one-handed. | **High** | Enlarge the entire row control and confirm destructive actions. | Make the completion button at least 44×44px with a visible label/state. Require a confirm dialog or undo snackbar for delete. |
| C-23 | Dashboard’s empty and priority states send users to Business Profile even when there may be no immediate business action. | “No urgent work right now” with an “Open” link to Profile is contradictory and produces a dead-end. | **Medium** | Make the next action contextual and remove meaningless CTAs. | If no profile: “Complete your business context.” If profile is complete and no reminders: “Try a task” linking to the main composer. If no actions: show a first-task CTA instead of a passive empty state. |
| C-24 | Dashboard reminders are read-only rows; users cannot complete, snooze, edit, or delete from the dashboard. | The dashboard promises a work overview but forces users into another screen for basic task management. | **High** | Make the dashboard useful for the next decision. | Add inline Complete, Snooze, and Open controls. Keep full editing on the Reminders screen. |
| C-25 | Dashboard refresh is a bare icon without busy, success, or error feedback. | Users cannot tell whether a refresh happened or whether local data is stale. | **Medium** | Give the action a visible state. | Animate the icon while refreshing, disable it briefly, and show “Updated just now.” If reading local data fails, show an inline error with Retry. |
| C-26 | Mobile header uses compact icon-first navigation for Chat, Notes, History, and Settings with labels hidden. | New users must guess icons or remember what each opens. Counts can add noise without explaining importance. | **High** | Use a predictable mobile navigation pattern. | Keep one `Menu` or bottom navigation with labeled items: Home, Chat, Tasks, Settings. Put Notes and History inside Chat or a Library section. |
| C-27 | Multiple drawers and overlays create layered back/close behavior. | Android back gestures may close the wrong layer, leave a modal underneath, or exit the app unexpectedly. | **High** | Define a single overlay stack and a strict back hierarchy. | Back order: close alert/approval → close nested panel → close drawer → leave route. Add visible titles and a consistent close button on every layer. |
| C-28 | The app does not make the post-task next action explicit. After a response or external handoff, the user is returned to the same general surface. | A beginner does not know whether to ask again, review the result, edit it, or start another task. | **High** | End every task with a clear completion affordance. | Add a result footer: `Done`, `Try another task`, `Edit`, or `Open activity`. For external handoff, explain the remaining human step. |
| C-29 | Normal task execution has no explicit empty/loading/success contract across surfaces. | The product feels inconsistent: voice has detailed states, text relies on busy state/toasts, dashboard relies on passive empties, and profile uses a small Saved label. | **High** | Standardize state vocabulary and placement. | Define shared states: `Empty`, `Loading`, `Success`, `Needs action`, `Error`, `Offline`. Every primary screen must render an inline state with one next action. |
| C-30 | The app does not clearly distinguish local-only data from cloud/account data at the moment of use. | Users may assume business profile, reminders, API key, and history sync across devices when they are local-first. | **High** | Make data scope visible where the data is entered. | Add a concise scope label beside each feature: “This device only,” “Cloud sync,” or “Not connected.” Explain what happens on reinstall or device change. |

## 3. Unnecessary screens and steps

### Screens that should be merged or reframed

The dedicated API settings route and the API section inside the Settings Drawer should not both behave as setup screens. Keep one canonical Connection screen. The drawer should only expose connection health and a link to fix it.

The Dashboard and Business Profile currently act as separate destinations even though the dashboard’s primary next step is often profile completion. The first profile completion should be a focused setup sheet or short route, not a full navigation detour with reminders attached.

The Chat Drawer and inline Chat Composer represent the same job. Keep the composer available in the main home surface and use the drawer only for conversation history or a larger conversation view. Do not make users choose “Chat” before they can send a task.

### Steps that should be removed

Remove model detection and multi-model selection from the first-run flow. Remove the need to save a key in one action and test it in another. Remove advanced wake triggers, persona prompts, performance controls, memories, theme, and briefing from the first-run path. These are not prerequisites for the first successful task.

Remove “Auto-open” from the primary action experience unless its semantics are made precise. If it only affects approved links, place it in Advanced preferences with a strong explanation.

### Steps that should be automated

After a successful connection test, automatically select the recommended Gemini model, save the connection state, and return the user to the first-task screen. Automatically inject business context only if the user has provided it; do not require a separate profile before a generic first task.

After a task succeeds, automatically create an action record with a precise lifecycle status. After an external app opens, automatically display the remaining human step rather than treating opening as completion.

When a dashboard Quick Action is tapped, automatically open the canonical composer, prefill the task, focus the input, and show a preview of the intended action before sending.

### Smart defaults that reduce effort

Default to Gemini, the recommended model, English UI, the user’s device locale for time formatting, SAR for Saudi users, `Once` for reminders, `Other` for reminder category, and a safe formal response tone. Default external auto-open to off. Default the first task to a low-risk, read-only briefing so the user experiences value without an approval interruption.

For profile setup, ask only business name, industry, and city initially. Infer or suggest timezone and currency from the selected country. Pre-fill working hours only if the user explicitly chooses a template; do not force a free-text schedule field during onboarding.

### Progressive disclosure rules

The first-run experience should expose only connection status, one voice/text entry, and examples. The main Settings landing page should expose only categories. Advanced settings should contain provider selection, model selection, wake triggers, sensitivity, latency, memories, custom persona, and technical diagnostics.

The approval card should show a concise summary first and an expandable “Show full details” section. The reminder form should show title and date first, with category, repeat, and notes behind “Add details.” The voice status should show one plain-language state first, with diagnostics behind “Technical details.”

## 4. Redesigned complete flow

### Flow A: first launch to first safe result

| Step | User sees | Primary action | Hidden/deferred content |
|---|---|---|---|
| 1 | “Welcome to Alpha. Tell me one business task. You can speak or type.” | `Continue` | No settings catalog, no model terminology. |
| 2 | Connection card: “Alpha needs Gemini to work.” | `Connect Alpha` | Provider/model selection hidden. |
| 3 | One API key field with show/hide and local-storage explanation. | `Save and test connection` | Detect models and multi-model selection hidden. |
| 4 | Inline progress and a definitive result. | On success: `Try your first task` | Technical check rows behind Details. |
| 5 | First task chooser with three examples: “Give me today’s priorities,” “Draft a customer follow-up,” “Summarize this text.” | `Try by voice` or `Use text instead` | Quick Skills catalog hidden. |
| 6 | If voice: permission explanation before the OS prompt. | `Allow microphone` | Android/browser technical instructions hidden unless denied. |
| 7 | One authoritative state: Ready, Listening, Understanding, Speaking, Done. | No decision needed | Latency and level diagnostics collapsed. |
| 8 | Result card with the assistant response and a clear completion line. | `Try another task` | History and Notes are secondary. |

### Flow B: voice-to-external-action

The user says, “Draft a WhatsApp follow-up for my customer.” Alpha should first show a transcript or interpreted intent: **“I’ll draft a WhatsApp follow-up. I will not send it without your approval.”** It should then produce a draft preview with recipient/context if known. If an external app must open, the approval card should say exactly: **“Open WhatsApp with this draft. You still need to press Send.”** The user chooses `Edit`, `Approve and open`, or `Cancel`. After handoff, the final status is **“WhatsApp opened — not sent by Alpha.”** This is the minimum trust contract for a voice-to-action product.

### Flow C: business context

After the first successful task, show a non-blocking card: **“Make Alpha more useful for your business.”** Ask for business name, industry, and city. Save continuously or provide a sticky Save button with dirty-state protection. After success, return to the main task surface and show “Business context added.” VAT, working hours, response tone, and reminders should be optional follow-up setup.

### Flow D: daily repeat use

The daily home surface should have one primary composer, one clearly labeled voice button, one recent task/result area, and one next recommended action. Navigation should use jobs rather than implementation features: **Home, Chat, Tasks, Settings.** Notes and History can be nested under Chat or Library. The dashboard should be a useful overview, not a required stop in the daily loop.

## 5. Standard state system required across the product

| State | Required wording pattern | Required UI behavior |
|---|---|---|
| Empty | “Nothing here yet” plus why it matters | One action to create or try something. |
| Loading | Plain-language activity, not just a spinner | Disable duplicate submission and preserve input. |
| Success | Confirm what happened and what did not happen | Give one next action. |
| Needs approval | State the exact action and side effect | Review, Edit, Approve, Cancel. |
| Failed | Explain cause in user language | Retry, Edit, or alternative path. |
| Offline/local-only | State whether data is safe and where it lives | Do not imply cloud sync. |
| Destructive | Name the object and consequence | Confirm or provide undo. |

## 6. Priority plan by impact

### P0: must fix before serious SME onboarding

1. Replace the split API setup with one canonical “Connect Alpha” flow.
2. Persist onboarding progress and do not restart a partially completed setup.
3. Reduce the first home surface to one primary voice/text task flow.
4. Redesign external approval to show the exact proposed action, destination, content, and remaining human step.
5. Define precise action statuses: approved, opened, draft ready, sent, failed, cancelled.
6. Add inline retry/error states for text and voice tasks instead of relying on toasts.
7. Split the long Settings Drawer into category pages with readiness status at the top.
8. Add Android back-stack behavior for nested drawers, modals, and approval dialogs.

### P1: must fix before paid conversion optimization

1. Split Business Profile and Reminders into separate jobs.
2. Add dirty-state protection and sticky Save/Cancel controls to Business Profile.
3. Make dashboard cards actionable: complete, snooze, open, try a task.
4. Replace icon-only mobile navigation with labeled navigation or one Menu.
5. Add pre-permission microphone explanation and a text fallback.
6. Standardize empty, loading, success, error, and offline states.
7. Make local-only data scope visible and explain reinstall/device limitations.
8. Add “Edit before approval” for drafts and safe external actions.

### P2: improve retention after the core path is reliable

1. Add a task/result timeline with clear replay and retry behavior.
2. Add optional business templates for Saudi SME workflows.
3. Add progressive onboarding for reminders, briefing, wake word, and memories.
4. Add analytics consent only after the user understands the product and before nonessential telemetry.
5. Add device-level QA for keyboard resize, safe areas, back gestures, permission denial, external app return, and interrupted voice sessions.

## 7. Recommended usability tests

Test five first-time Android users who do not know the implementation details. Give them only this task: **“Use Alpha to prepare today’s business priorities, then draft a WhatsApp follow-up and tell me whether it was sent.”** Do not explain the UI.

Measure time to first successful result, number of setup questions, number of back presses, number of accidental exits, whether the user understands the difference between draft/opened/sent, whether the user can recover from denied microphone permission, and whether the user can return to the same task after editing the business profile.

A release should not pass if a participant cannot answer these three questions without help: **“What should I do next?”, “What exactly will Alpha do if I approve?”, and “Did the task actually finish?”**

## Final redesign principle

> **Minimum effort → maximum clarity → obvious next action.**

Alpha should not ask a new user to configure an assistant. It should let the user complete one safe, useful business task, explain the result, and then invite optional personalization. Every screen should answer one question only: **What is happening, what can I do now, and what will happen next?**

This audit is based on the current implementation in `src/routes/index.tsx`, `src/components/realtime/MainStage.tsx`, `src/components/realtime/FirstRunOnboarding.tsx`, `src/routes/api-settings.tsx`, `src/components/realtime/SettingsDrawer.tsx`, `src/components/realtime/ActionsList.tsx`, `src/routes/dashboard.tsx`, and `src/routes/business-profile.tsx`.
