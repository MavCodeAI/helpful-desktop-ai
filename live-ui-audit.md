# Alpha live UI audit — 2026-08-16

## Home and onboarding

- Local server returned HTTP 200 at `http://localhost:8080/`; repository HEAD was `cf6ba70` with clean status at audit start.
- Home renders Alpha header, Quick Skills, voice orb, status, and the always-visible bilingual command bar.
- Fresh browser state displayed the three-step Urdu onboarding correctly. Dismiss (`بعد میں`) removed the modal and exposed Home controls.
- The live screenshot shows the desktop-width sandbox viewport; physical 360–375px Android behavior still requires device validation.

## Chat drawer

- Chat opens from Home and exposes New chat, Clear chat, Close chat, Urdu empty state, textarea, and send button.
- Touch targets are present and the drawer overlays the right side in the desktop-sized audit viewport. Need to inspect mobile CSS/other drawers and confirm no English-only empty states remain.

## Notes drawer

- Notes opens as a left-side sheet in the sandbox viewport and exposes close, AI toggle, add note input, Add button, and a clear Urdu/English empty state.
- A live issue is visible in the current language: the Notes sheet still contains English-only interactive labels and helper copy (`Add a note…`, `Add`, `No notes yet`, and the AI helper sentence) while the rest of the Home UI is Urdu. This is a bilingual consistency gap to fix.
- The sheet is visually compact and its controls are accessible in the desktop-sized viewport; narrow Android keyboard behavior still needs source-level review.

## History drawer

- History opens as a left-side sheet with close, New conversation, search, and saved thread row controls.
- A clear live issue is present: the drawer is English-only in Urdu mode (`Conversations`, `1 saved · this browser`, `New conversation`, `Search title or message…`, and the thread timestamp row). This conflicts with the app's Urdu-only script policy when Urdu is selected.
- The left sheet remains inside the viewport in the current sandbox view, but its narrow width makes the English title and metadata visually dense. Mobile layout should use shorter bilingual labels and allow metadata wrapping.

## Dashboard and Business Profile

- Dashboard is visually coherent and responsive in the current viewport. Its core content is Urdu, but quick-action labels remain English (`WhatsApp draft`, `Email draft`, `Business briefing`), creating a bilingual consistency gap in Urdu mode.
- Dashboard cards and reminder rows fit without visible horizontal overflow in the live viewport. The quick actions are compact and should be checked against the 44px target on a physical narrow phone.
- Business Profile form stacks into a compact two-column layout in the current viewport. Labels and core controls are Urdu, recurrence options work, and reminder action buttons expose accessible hints.
- Business Profile reminder data contains English titles and notes from test data, which is user-entered content rather than a translation defect. Header metadata still mixes `SAR · Saudi SME`, acceptable as product branding but potentially worth localization later.
- Date input displays the browser-native `mm/dd/yyyy` hint in the sandbox; this is platform-controlled and may differ on Android locale.

## API Settings and Memories

- API Settings is compact and fits the live viewport. The Gemini key field, show/hide control, save button, model lookup, and connection test are visible with Urdu labels. No visible overflow was found in the current viewport.
- The API provider selector exposes Tavily and future providers in addition to Gemini. This is not a layout defect, but the product policy should keep the UI copy clear about which providers are actually active.
- Memories has a clean Urdu empty state and a mobile-friendly single-row add field in the current viewport. No visible overflow was found. The live empty state is clearer than the Notes drawer, so Notes and History should be brought to the same localization quality.

## Post-fix live verification

- Home continues to render the Urdu quick-skill grid, command textarea, voice orb, and header controls without visible horizontal overflow in the live viewport.
- History drawer now shows Urdu heading, saved-browser summary, new-conversation action, Urdu search placeholder, Urdu close labels, and Urdu message-count metadata. A pre-existing user-created thread title `New conversation` remains English content rather than a component label.
- Notes drawer now shows Urdu dialog labels, AI state tooltip, Urdu placeholder, Urdu add action, and Urdu empty-state guidance. The drawer remains a full-height mobile sheet and its close/AI controls are discoverable.
- One remaining product polish opportunity is that the compact Home header keeps English visual labels (`Chat`, `Notes`, `History`, `Settings`) even while the surrounding surface is Urdu; their accessible hints are clear. This may be intentional brand/navigation shorthand, but a fully Urdu mode could localize the visible labels too.
