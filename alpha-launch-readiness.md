# Alpha Launch Readiness

## Applied in this tranche

The production baseline remediation moved user-provided Gemini and Tavily keys out of `localStorage` and into session-scoped storage. Legacy local-storage copies are removed during migration, the Danger Zone clears both storage areas, and the settings disclosure now accurately states that keys are used only for the current session. Global app metadata now marks the authenticated application surface as `noindex, nofollow`, and `public/robots.txt` disallows crawler access. The dependency graph pins patched `js-yaml`, `nanoid`, and `brace-expansion` versions through `pnpm-workspace.yaml`. The direct `vite-tsconfig-paths` dependency was removed because the project wrapper already resolves paths and the old direct package caused a Vite warning. All AI server endpoints now use a central fail-closed key policy: a user-supplied session key is accepted, while deployment environment-key fallback requires the explicit `ALPHA_ALLOW_SERVER_AI_FALLBACK=true` opt-in. This prevents an anonymous client from silently spending a deployment secret by default.

## Verification

| Check | Result |
|---|---|
| Production web build | Passed |
| Unit tests | Passed: 25 tests in 2 files |
| ESLint | Passed with 0 errors and 0 warnings |
| Dependency audit | Passed after patched overrides, including `brace-expansion` |
| AI key fallback policy | Fail-closed by default; server fallback requires explicit opt-in |
| Capacitor sync | Passed |
| Android release assemble | Passed technically |
| APK metadata | `com.mavcodeai.alpha`, version `1.2.0`, versionCode `6` |
| APK SHA-256 | `47c1253e91a462cda0cfae6465ec06f5c2360ca8e08232f6ecd974edc9b14d93` |

## Launch blockers that require explicit resolution

### Server authorization

The current server functions accept optional `userKey` values and can fall back to deployment environment keys. No user authentication or per-account authorization boundary is visible in the current server-function layer. A public SaaS deployment must add authenticated sessions, per-user ownership checks, rate limits/quotas, abuse monitoring, and server-side audit logging before exposing environment-backed AI calls to the public internet.

### Android signing

The current Gradle release build succeeds, but the resulting APK is **unsigned** because `android/keystore.properties` is absent. An official production release requires the owner's permanent Android upload/release keystore. The generated signing identity must not be replaced later, or users will be unable to update the installed app normally.

### Physical device QA

The sandbox cannot validate physical microphone permission prompts, Android keyboard resize behavior, back gestures, audio routing, WhatsApp/Email handoff, backgrounding, battery restrictions, or real network transitions. These remain required before public release.

### Remaining launch blockers

The code-quality and dependency gates are now clean. The remaining launch blockers are product/infrastructure requirements rather than local source warnings: authenticated user sessions and per-account ownership checks for a public SaaS deployment; a permanent owner-controlled Android release keystore; physical Android QA for microphone permissions, keyboard resize, back gestures, audio routing, external app handoff, backgrounding, battery restrictions, and real network transitions; and production rate limits, quotas, abuse monitoring, and server-side audit logging. These cannot be safely fabricated in the sandbox without the owner's identity, keystore, deployment configuration, and target device.
