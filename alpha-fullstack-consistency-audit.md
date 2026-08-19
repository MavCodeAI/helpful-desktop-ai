# Alpha Full-Stack Consistency Audit

## Scope

This audit traced Alpha’s route surface, frontend call sites, server-function validators, AI key resolution, local-first storage, notes flow, web search, news, voice token, and chat contracts. It focused on verified implementation mismatches rather than speculative redesign.

## Verified findings and remediation

| Severity | Area | Root cause | User impact | Remediation |
|---|---|---|---|---|
| High | Tavily web search | `web-search.functions.ts` resolved `TAVILY_API_KEY` directly from `process.env`, bypassing the central fail-closed `resolveAiKey` policy. | An anonymous request could use a deployment Tavily secret even when server fallback was disabled, creating an inconsistent security boundary and abuse risk. | Routed Tavily resolution through `resolveAiKey(userKey, "TAVILY_API_KEY")`. The deployment key is now available only when explicit server fallback is enabled. |
| High | AI Notes | `NotesDrawer` called `generateNote` with only `prompt`, although the server contract accepts an optional user Gemini key and the product now uses session-only keys. | AI Notes could fail after a user successfully applies a Gemini key in Settings because the drawer did not forward that session key. | `NotesDrawer` now loads current settings at submit time and forwards the session Gemini key. The draft remains intact on failure. |
| Medium | Provider consistency | Gemini chat, notes, memories, Live token, diagnostics, and web search now use the central policy, while keyless news intentionally remains a public-source feature. | Users can receive news without an AI key, but AI summarization still correctly requires an allowed Gemini key and falls back to headlines when unavailable. | Kept this distinction explicit rather than forcing a key requirement onto GDELT/Google RSS retrieval. |
| Medium | Anonymous production abuse | Server-function contracts validate shapes and lengths, but repository inspection does not prove deployed authentication, per-account ownership, rate limits, quota enforcement, or server-side audit logging. | A public deployment may still be abused or incur provider cost if platform-level auth and rate limiting are not configured. | Not fabricated in code. These remain deployment launch gates requiring the real auth, hosting, and billing configuration. |
| Medium | Session key lifecycle | Session-only key behavior is correct for privacy, but reload/close intentionally removes the key. | Users may interpret a later AI failure as a bug if they do not understand that they must Apply & Test again after a new session. | Existing onboarding/settings disclosure states this behavior; the remaining improvement is a post-reload recovery CTA in the real deployed environment. |

## Contract map

| Flow | Frontend caller | Server contract | Result |
|---|---|---|---|
| Text chat | `use-voice-app.ts` | `chatReply` validates up to 50 messages and forwards the selected user key | Consistent with the session-only policy. |
| Live voice | `use-realtime-session.ts` | `getGeminiLiveToken` | Central fail-closed key policy applies. |
| API test | `ApiKeysSection.tsx` | `getAiHealth` and `testGeminiLiveConnection` | Uses the configured key and explicit Apply & Test flow. |
| Web search | `web-search-cache.ts` | `webSearchSummarize` | Fixed: Tavily now uses the central policy; Gemini grounding uses the same server helper. |
| News | `use-voice-app.ts` | `getLatestNews` | Keyless GDELT/Google RSS retrieval is intentional; AI summary uses the optional Gemini key. |
| AI notes | `NotesDrawer.tsx` | `generateNote` | Fixed: session Gemini key is forwarded at submit time. |
| Memory extraction | `use-memories.ts` and `use-voice-app.ts` | `extractMemoryFacts` | User key is forwarded and local persistence remains explicit. |

## Validation

The following checks passed after remediation:

- ESLint completed with zero errors and zero warnings.
- Vitest completed successfully with the project’s available test suite.
- Production web build completed successfully.
- The server bundle includes the updated NotesDrawer and web-search modules.

## Remaining launch gates

The repository cannot prove physical Android microphone permission behavior, keyboard/back gesture behavior, WhatsApp or Email handoff behavior, official release-keystore signing, deployed authentication, production rate limiting, provider quota enforcement, or server-side per-account ownership from the sandbox alone. These must be verified in the real deployment and on a physical Android device before a public SaaS launch.

## Recommended next implementation order

1. Configure and verify authenticated deployment sessions and per-user ownership boundaries.
2. Add provider rate limits, usage counters, quota responses, and server-side audit events.
3. Add an explicit “AI key required after reload” recovery CTA in the deployed app.
4. Run physical Android QA for microphone permissions, keyboard resize, back gestures, safe areas, and external-app handoff.
5. Add integration tests for key-policy fail-closed behavior and AI Notes/web-search forwarding.
