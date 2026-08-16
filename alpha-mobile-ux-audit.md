# Alpha — Complete UI/UX and Mobile-First Audit

**Audit scope:** Home, onboarding, API setup, voice interaction, chat, notes, history, approvals, Dashboard, Business Profile, reminders, Memories, Settings, API Settings, loading/error/empty/success states, responsive behavior, navigation, and Android-specific risks.

**Audit method:** Source-level inspection of the current TanStack Start frontend plus live browser smoke checks previously performed across Home, drawers, Dashboard, Business Profile, API Settings, and Memories. Physical Android-device testing was not available; keyboard, permission dialogs, back gesture, rotation, WebView differences, and 320px devices therefore remain device-QA items.

## Executive summary

Alpha کی visual direction مضبوط ہے: dark premium styling، English-only frontend، واضح central voice orb، responsive cards، safe-area support، approval protection اور کم از کم touch targets کئی اہم screens پر درست ہیں۔ تاہم beginner کے لیے سب سے بڑا مسئلہ visual نہیں بلکہ **workflow clarity** ہے۔ ایک نئے user کو پہلے یہ سمجھنا پڑتا ہے کہ API key کہاں لگانی ہے، کون سا test چلانا ہے، voice permission کیسے دینی ہے، command کیسے دینی ہے، اور approval کے بعد action مکمل ہوا یا صرف external app کھلی۔

سب سے زیادہ اہم friction points یہ ہیں: API setup کا technical ہونا، Settings کا بہت لمبا single drawer ہونا، voice states کا کم واضح ہونا، Home پر مثالوں اور next-step guidance کی کمی، Quick Skills کے بعد result/action completion کا کم واضح ہونا، recurring reminders کے notification behavior کا ambiguous ہونا، اور حقیقی Android keyboard/back/permission states کی عدم جانچ۔

## Severity model

| Priority | مطلب |
|---|---|
| P0 | بنیادی workflow رک جاتا ہے، user کام مکمل نہیں کر پاتا، یا safety/trust risk پیدا ہوتا ہے۔ |
| P1 | اہم friction؛ conversion، activation یا repeat usage پر واضح اثر پڑتا ہے۔ |
| P2 | usability یا polish issue؛ کام ممکن ہے مگر experience کم professional محسوس ہوتا ہے۔ |
| P3 | edge-case، accessibility polish یا device-specific QA item۔ |

## 1. First launch and onboarding

### Step flow

`First launch → Welcome → Get started → Connect your AI → Open Settings → paste Gemini key → Apply & Test → return to Home → Try first task`.

| Priority | مسئلہ | User کو مشکل | بہتر طریقہ |
|---|---|---|---|
| P1 | Onboarding API key، local storage، Apply & Test اور voice setup کو ایک ہی conceptual flow میں جوڑتا ہے۔ | Beginner کو معلوم نہیں ہوتا کہ key کہاں سے ملے گی، کیا یہ لازمی ہے، اور setup مکمل کب سمجھا جائے گا۔ | Onboarding میں واضح progress checklist رکھیں: `1. Add key 2. Allow microphone 3. Run first task`. ہر step کے ساتھ short explanation اور success check دکھائیں۔ |
| P1 | `Open Settings` کے بعد user واپس onboarding میں نہیں آتا؛ modal hide ہو جاتا ہے۔ | User کو یہ یاد نہیں رہتا کہ اگلا step کیا تھا، اور key save کے بعد first task کہاں چلانا ہے۔ | Settings close ہونے پر `Setup progress` banner دکھائیں: `Gemini connected — Continue to your first task`. |
| P1 | Onboarding کا first task voice capability کا وعدہ کرتا ہے مگر user text command سے بھی چلا سکتا ہے۔ | User کو voice permission، text fallback اور expected result کے درمیان فرق واضح نہیں ہوتا۔ | Step 3 میں دو واضح choices دیں: `Try by voice` اور `Try by text`; microphone deny ہو تو text fallback دکھائیں۔ |
| P2 | Skip for now button onboarding completion کو permanently set کر دیتا ہے۔ | User بعد میں guided setup دوبارہ نہیں کھول سکتا جب تک storage manually clear نہ کرے۔ | Settings میں `Restart setup guide` action دیں اور skip کے ساتھ لکھیں: `You can reopen this guide later in Help`. |
| P2 | Progress indicator صرف 1/3, 2/3, 3/3 ہے۔ | User کو معلوم نہیں کہ key valid ہے یا microphone configured ہے۔ | Progress کو named steps بنائیں: `Welcome`, `Connect`, `First task`. Completed state checkmark کے ساتھ دکھائیں۔ |
| P2 | Modal mobile پر readable ہے، مگر واقعی device keyboard/permission state verify نہیں۔ | Small Android پر modal کے نیچے action keyboard یا system permission کے ساتھ conflict کر سکتا ہے۔ | Physical device test: 320px/375px، keyboard open، permission denied، landscape۔ |

## 2. API key setup and provider configuration

### Step flow

`Settings → AI APIs → Gemini key → Apply & Test → model check → Gemini Live handshake → success/error → optional Tavily key → API Settings for models`.

| Priority | مسئلہ | User کو مشکل | بہتر طریقہ |
|---|---|---|---|
| P0 | User-facing copy اب بھی server/local/Vercel concepts بتاتی ہے۔ | Non-technical SME owner کو local key، server key اور production secret کا فرق سمجھ نہیں آتا۔ | Default view میں صرف simple language رکھیں: `Use your own Gemini key on this device`. Advanced technical details کو `How keys work` accordion میں رکھیں۔ |
| P1 | `Apply & Test` ایک ہی button میں save، model test اور realtime handshake کرتا ہے۔ | Loading طویل ہو تو user کو معلوم نہیں ہوتا کہ کون سا مرحلہ چل رہا ہے؛ failure کی اصل جگہ غیر واضح رہتی ہے۔ | Button کے نیچے sequential progress دکھائیں: `Checking key → Checking model → Checking live voice → Ready`. |
| P1 | Gemini failure اور Live voice failure الگ technical paths ہیں مگر final error ایک compact message میں آ سکتا ہے۔ | User key دوبارہ paste کرتا رہتا ہے جبکہ مسئلہ microphone یا realtime access ہو سکتا ہے۔ | Error کو category دیں: `Key rejected`, `Model unavailable`, `Microphone blocked`, `Live voice unavailable`, `Network timeout`؛ ہر category کے ساتھ next action۔ |
| P1 | Tavily optional ہے مگر feature availability واضح نہیں۔ | User سمجھ سکتا ہے کہ search/news لازمی طور پر کام کرے گا یا Gemini fallback خود available ہے۔ | Tavily block پر badge لگائیں: `Optional — improves live web search`; missing key پر Gemini fallback واضح کریں۔ |
| P1 | Key clear کرنے سے local key ختم ہوتی ہے مگر server-side key باقی رہ سکتی ہے۔ | User کو security state پر غلط confidence ہو سکتا ہے۔ | Clear action کے بعد explicit result دکھائیں: `Local key removed. Server configuration was not changed.` ساتھ `Remove server key` کو separate admin-only action رکھیں۔ |
| P2 | Dedicated API Settings route اور Settings drawer دونوں setup surfaces ہیں۔ | Duplicate paths navigation کو confusing بناتے ہیں۔ | ایک primary setup surface منتخب کریں؛ دوسرے کو `Advanced API settings` کے طور پر clearly label کریں۔ |
| P2 | Models detect ہونے کے بعد model list، filter، selection اور per-model Test mobile پر dense ہو سکتے ہیں۔ | Small screen پر checkbox، model name اور Test button ایک row میں cramped محسوس ہوں گے۔ | Model cards کو stacked mobile layout دیں: name، capability chips، checkbox، full-width Test action۔ |
| P2 | API test success toast جلد غائب ہو سکتی ہے۔ | User کو بعد میں معلوم نہیں رہتا کہ key واقعی working تھی۔ | Persistent `Connected` status card رکھیں جس میں last tested time، latency اور tested capabilities ہوں۔ |
| P3 | Clipboard paste، key reveal، accidental clear اور key format validation کم واضح ہیں۔ | User invalid/partial key paste کر سکتا ہے اور technical rejection دیکھتا ہے۔ | Paste validation، reveal icon، clear confirmation اور `Key format looks valid` preflight شامل کریں۔ |

## 3. Home, voice, and command flow

### Step flow

`Open Home → understand prompt → speak/type → listening → thinking → response → optional approval → completion`.

| Priority | مسئلہ | User کو مشکل | بہتر طریقہ |
|---|---|---|---|
| P0 | Voice state کے تمام مراحل ایک consistent visual timeline میں نہیں دکھتے۔ | User نہیں جانتا کہ Alpha سن رہا ہے، سوچ رہا ہے، بول رہا ہے، یا stuck ہے۔ | Orb کے ساتھ fixed state label دکھائیں: `Ready`, `Listening`, `Processing`, `Speaking`, `Needs approval`, `Done`, `Error`. ہر state کے لیے icon/color/animation رکھیں۔ |
| P1 | Home command bar کا example محدود ہے۔ | Beginner کو معلوم نہیں ہوتا کہ Alpha سے کون سے Saudi SME tasks مانگے جا سکتے ہیں۔ | Rotating examples دکھائیں: `Draft a WhatsApp follow-up`, `Create a weekly payment reminder`, `Summarize today’s business news`, `Read this invoice`. |
| P1 | Microphone permission denied message Android/browser settings کی طرف بھیجتا ہے مگر exact recovery path device-specific ہے۔ | User settings میں جا کر واپس app تک نہیں پہنچ پاتا۔ | `Open microphone settings` جہاں platform support کرے؛ ورنہ numbered instructions اور `Use text instead` fallback دکھائیں۔ |
| P1 | Voice error card retry اور Settings دیتا ہے مگر error category کے مطابق next step مختلف نہیں۔ | ہر failure کے لیے ایک ہی recovery path ملتا ہے۔ | Error-specific CTA دیں: `Retry`, `Open API settings`, `Allow microphone`, `Use text chat`, `Try later`. |
| P1 | Home پر orb، Quick Skills، command bar، HUD، status، ActionsList اور error area ایک ساتھ آ سکتے ہیں۔ | Small screen پر information hierarchy competing محسوس ہو سکتی ہے۔ | Default home کو تین layers تک محدود کریں: primary command bar، compact state، contextual result. HUD/latency کو `Details` میں رکھیں۔ |
| P2 | Text fallback موجود ہے مگر واضح نہیں کہ voice کے بغیر app مکمل کام کر سکتی ہے۔ | Permission یا unsupported device والا user app چھوڑ سکتا ہے۔ | Command bar کے نیچے واضح copy: `Voice optional — type any command instead`. |
| P2 | New/Clear chat controls response stream کے بعد ظاہر ہوتے ہیں، پہلے نہیں۔ | User پہلے سے conversation reset کرنے کا option نہیں دیکھتا۔ | Header یا composer actions میں ہمیشہ `New chat` accessible رکھیں، جبکہ `Clear` کو confirmation کے بعد رکھیں۔ |
| P3 | Latency/status chips narrow screens پر wrap ہو سکتے ہیں، مگر actual Android WebView test باقی ہے۔ | Unusual widths پر footer vertical space زیادہ لے سکتا ہے۔ | 360px، 320px اور landscape screenshots کے ساتھ automated visual regression test رکھیں۔ |

## 4. Approval-based WhatsApp, Email, and external actions

### Step flow

`User command → draft/action prepared → approval card → review → Approve/Edit/Cancel → external app/browser opens → audit record`.

| Priority | مسئلہ | User کو مشکل | بہتر طریقہ |
|---|---|---|---|
| P0 | Approval card safety-focused ہے، مگر final destination/payload کو ہر action کے لیے equally prominent بنانا ضروری ہے۔ | User غلط recipient، URL، subject یا message approve کر سکتا ہے۔ | Card میں fixed order رکھیں: `Action type`, `Recipient/destination`, `Subject`, `Full message`, `What will happen next`, `Edit`, `Approve`, `Cancel`. |
| P0 | External app کھلنے کے بعد Alpha میں completion state ہمیشہ واضح نہیں۔ | User نہیں جانتا کہ action send ہوا، صرف draft کھلا، یا ابھی pending ہے۔ | Status lifecycle بنائیں: `Draft ready → Approved → Opened → User sent externally`؛ آخری step کو honest رکھیں کیونکہ Alpha external send verify نہیں کر سکتا۔ |
| P1 | Edit flow approval card سے فوری اور consistent نہیں۔ | User cancel کر کے دوبارہ command دینے پر مجبور ہو سکتا ہے۔ | `Edit draft` inline composer کھولے اور approval card updated preview دکھائے۔ |
| P1 | Approval required ہونے کی وجہ ہر action میں short explanation کے ساتھ نہیں آتی۔ | Safety behavior friction یا arbitrary block محسوس ہو سکتا ہے۔ | Copy: `Alpha needs your approval before opening WhatsApp or sending data outside the app.` |
| P2 | Action history status، kind اور label dense metadata میں ہے۔ | Mobile پر audit log پڑھنا مشکل ہو سکتا ہے۔ | Status chips، relative time، expandable details اور filter by `Pending / Completed / Rejected` دیں۔ |
| P2 | Auto-open checkbox advanced safety setting ہے۔ | Beginner unknowingly automation behavior بدل سکتا ہے۔ | اسے `Advanced safety` section میں رکھیں، default off، اور plain-language explanation دیں۔ |

## 5. Chat drawer and text composer

### Step flow

`Open Chat → empty state or messages → type → send → processing → response → optional note/action`.

| Priority | مسئلہ | User کو مشکل | بہتر طریقہ |
|---|---|---|---|
| P1 | New، Clear اور Close تین controls ایک ہی mobile header میں ہیں۔ | Narrow phones پر header cramped ہو سکتا ہے، خاص طور پر long localized labels یا browser zoom کے ساتھ۔ | Primary `Close`، secondary overflow menu میں `New` اور `Clear`؛ یا New کو full-width empty state CTA بنائیں۔ |
| P1 | Clear دو taps مانگتا ہے مگر confirmation context کم ہے۔ | User کو معلوم نہیں کہ current thread، all history یا visible messages clear ہوں گے۔ | Confirmation copy واضح کریں: `Clear messages from this chat? Saved history will remain.` |
| P1 | Composer میں send، Enter behavior اور busy state موجود ہیں، مگر next-state guidance محدود ہے۔ | User submit کے بعد خاموش waiting محسوس کر سکتا ہے۔ | Send کے بعد inline status `Alpha is thinking…`، cancel/stop option، failure retry اور draft preservation دیں۔ |
| P2 | Textarea one-line growing ہے؛ long message کے لیے height behavior physical mobile پر verify ہونا چاہیے۔ | Long Urdu/English prompt لکھتے وقت text hidden یا keyboard overlap ہو سکتا ہے۔ | max-height، internal scroll، keyboard-safe bottom inset اور visible multiline affordance دیں۔ |
| P2 | Empty state میں example command نہیں۔ | Blank drawer user کو inspire نہیں کرتا۔ | 2–3 tappable examples رکھیں جو composer میں prompt fill کریں، auto-send نہ کریں۔ |
| P2 | Note action composer prop سے موجود ہے مگر user کو ہر context میں visible affordance واضح نہیں۔ | Chat result کو Notes میں save کرنے کا طریقہ discover نہیں ہوتا۔ | `Save as note` action کو response bubble کے ساتھ contextual رکھیں۔ |

## 6. Notes flow

### Step flow

`Open Notes → Add note or AI note → type → Save → note list → timestamp/delete`.

| Priority | مسئلہ | User کو مشکل | بہتر طریقہ |
|---|---|---|---|
| P1 | Notes drawer میں global AI toggle اور per-note AI mode دونوں concepts موجود ہیں۔ | User سمجھ نہیں پاتا کہ toggle future notes بدلتا ہے یا current note۔ | دو separate labels رکھیں: `AI-assisted notes: On/Off` اور current form label `Create with AI`۔ |
| P1 | Save success feedback محدود ہے۔ | User کو یقین نہیں رہتا کہ note محفوظ ہوئی یا صرف form clear ہوا۔ | Inline success row `Saved just now`، undo اور failure retry دیں۔ |
| P2 | Delete action mobile پر hover affordance پر depend کر سکتا ہے۔ | Touch device پر delete discoverability کم ہو سکتی ہے۔ | Always-visible icon button یا swipe action؛ destructive delete کے لیے confirmation/undo۔ |
| P2 | Notes organization basic ہے۔ | Business users کے لیے invoice، client، task اور personal notes الگ کرنا مشکل ہے۔ | Tags/folders یا at least `Business`, `Clients`, `Tasks` filters دیں۔ |
| P3 | Long notes، keyboard-open state اور drawer scroll کو physical Android پر verify کرنا باقی ہے۔ | Small phone پر save button keyboard کے پیچھے آ سکتا ہے۔ | Keyboard-safe footer اور real-device QA۔ |

## 7. History flow

### Step flow

`Open History → search or browse threads → open thread → rename/delete → new conversation`.

| Priority | مسئلہ | User کو مشکل | بہتر طریقہ |
|---|---|---|---|
| P1 | Thread rows میں open، rename اور delete actions dense ہیں۔ | User غلط icon press کر سکتا ہے یا action discover نہیں کر سکتا۔ | Row tap = open؛ overflow menu = Rename/Delete؛ delete کے لیے undo toast۔ |
| P1 | Saved thread title کبھی `New conversation` رہ سکتا ہے۔ | History میں meaningful context نہیں بنتا۔ | First user command سے automatic title generate کریں، editable رکھیں۔ |
| P2 | Search no-match state کو next action کی ضرورت ہے۔ | User سمجھتا ہے history خالی ہے یا search غلط ہے۔ | `No matches for “…”` + `Clear search` button + total saved count دکھائیں۔ |
| P2 | Dates/message counts compact metadata میں ہیں۔ | Mobile پر scan کرنا مشکل ہو سکتا ہے۔ | Relative time (`Today`, `Yesterday`) اور expanded details on tap۔ |
| P3 | Android back gesture drawer close behavior source میں a11y hooks سے supported ہے، مگر physical device test باقی ہے۔ | Back پر app exit یا unexpected navigation ہو سکتی ہے۔ | Android device test اور explicit back-handling telemetry۔ |

## 8. Dashboard flow

### Step flow

`Open Dashboard → understand summary → inspect reminders/actions → open profile or quick action`.

| Priority | مسئلہ | User کو مشکل | بہتر طریقہ |
|---|---|---|---|
| P1 | Dashboard stats informative ہیں مگر recommended next action prominent نہیں۔ | Beginner numbers دیکھتا ہے مگر نہیں جانتا اب کیا کرنا ہے۔ | Top card `Today’s priority` رکھیں: missing profile، overdue reminder، pending approval یا first action۔ |
| P1 | Quick actions currently link to `/` rather than carrying a prefilled command context۔ | User `WhatsApp draft` دبانے کے بعد صرف Home پر جاتا ہے؛ اسے دوبارہ command دینا پڑتی ہے۔ | Link state/intent pass کریں: Home command bar prefilled with selected action and ready for review. |
| P2 | Due soon filter only `item.dueDate >= today` ہے؛ overdue reminders الگ prominent section میں نہیں۔ | Late tax/payment/license task hidden محسوس ہو سکتا ہے۔ | `Overdue`, `Today`, `Upcoming` sections with red/amber/neutral priority۔ |
| P2 | Refresh button manual ہے؛ localStorage changes across tabs/devices automatically sync نہیں ہوتے۔ | دوسری tab یا Android route سے واپس آنے پر stale data دکھ سکتا ہے۔ | route focus پر refresh، storage event، اور visible `Last updated` timestamp۔ |
| P2 | Empty dashboard profile completion message ہے مگر business-first setup wizard نہیں۔ | User profile، reminder اور API setup کی ترتیب خود طے کرتا ہے۔ | Guided checklist: `Connect AI → Complete profile → Add first reminder → Run first briefing`. |
| P3 | Dashboard date formatting and timezone behavior should be tested against Saudi timezone and device timezone. | Due dates midnight boundary پر غلط day دکھا سکتی ہیں۔ | Explicit timezone strategy and date-only formatting for reminder dates۔ |

## 9. Business Profile and reminder flow

### Step flow

`Open Business Profile → fill fields → Save profile → create reminder → choose date/category/repeat → add → complete/delete`.

| Priority | مسئلہ | User کو مشکل | بہتر طریقہ |
|---|---|---|---|
| P1 | Profile form میں Business name، Industry، City، Working hours، Tone اور VAT ایک ہی screen پر ہیں، مگر required/optional distinction واضح نہیں۔ | User نہیں جانتا کیا بھرنا ضروری ہے؛ setup abandoned ہو سکتا ہے۔ | Required fields mark کریں، `Skip optional fields` allow کریں، اور save سے پہلے inline validation دیں۔ |
| P1 | Save button save کے بعد صرف text state تک محدود ہے۔ | User کو persistence، last saved time یا error واضح نہیں۔ | Button state `Save profile → Saving… → Saved`، inline timestamp اور failure retry۔ |
| P1 | Reminder creation میں title، date، category، repeat اور notes ایک ہی form row/stack ہے۔ | Small mobile پر form لمبا اور cognitively heavy ہے۔ | Two-step compact form: `What and when?` then optional `Category and repeat`; notes collapsed by default۔ |
| P1 | Recurring reminder complete ہونے پر date advance ہوتی ہے، مگر notification behavior واضح نہیں۔ | User سمجھ سکتا ہے کہ Android notification ضرور آئے گی۔ | Copy واضح کریں: `This is an in-app reminder. Device notifications require notification permission and scheduled notifications.` |
| P2 | Date input browser-native ہے۔ | Android/desktop browsers میں date picker language/format مختلف ہو سکتی ہے۔ | Show formatted selected date and validate past dates; use a consistent date picker where feasible۔ |
| P2 | Delete reminder immediate ہے۔ | Accidental tap سے reminder ضائع ہو سکتا ہے۔ | Undo toast یا compact confirm dialog۔ |
| P2 | Category and repeat labels are useful but no priority/severity exists۔ | Tax/payment deadlines اور ordinary meetings برابر دکھتے ہیں۔ | Add priority: `High`, `Normal`, `Low`; overdue/high-risk reminders visually prominent۔ |
| P3 | Currency is fixed SAR and Saudi context is strong۔ | Future multi-country support کے لیے model inflexible ہے، مگر current Saudi-first scope میں acceptable ہے۔ | Keep SAR default, but make country/currency a clear future-ready profile field۔ |

## 10. Memories flow

### Step flow

`Open Memories → understand memory purpose → add/search → inspect/delete → clear all`.

| Priority | مسئلہ | User کو مشکل | بہتر طریقہ |
|---|---|---|---|
| P1 | Memory اور Notes کا فرق فوراً واضح نہیں۔ | User personal preference، business context اور temporary note غلط جگہ save کر سکتا ہے۔ | Top explanation: `Memories help Alpha remember preferences and recurring context. Notes are documents you save.` |
| P1 | Clear all destructive action high impact ہے۔ | Accidental tap سے accumulated context ضائع ہو سکتا ہے۔ | Require confirmation with count and typed/explicit confirmation; provide export before clear۔ |
| P2 | Search/add/list empty states basic ہیں۔ | First-time user کو کوئی example نہیں ملتا۔ | Example chips: `Preferred tone`, `Business hours`, `Important client preference`; one-tap add۔ |
| P2 | Individual memory delete lacks undo/export workflow۔ | Mistake recover نہیں ہوتی۔ | Undo toast and `Export memories` option۔ |

## 11. Settings drawer overall navigation

### Step flow

`Open Settings → scroll a long sheet → configure voice/performance/triggers/persona/language/region/memory/briefing/privacy/theme/API/danger`.

| Priority | مسئلہ | User کو مشکل | بہتر طریقہ |
|---|---|---|---|
| P0 | بہت سے unrelated sections ایک long scrollable drawer میں packed ہیں۔ | Beginner کو relevant setting تلاش کرنے میں وقت لگتا ہے؛ important setup buried ہو جاتا ہے۔ | Settings home کو grouped categories میں تقسیم کریں: `Getting started`, `Voice`, `AI & search`, `Business`, `Automation`, `Privacy`; ہر group separate page/sheet۔ |
| P1 | Settings drawer میں current state summary اوپر محدود ہے۔ | User کو معلوم نہیں کہ app ready ہے یا کون سا setup missing ہے۔ | Sticky readiness header: `AI connected`, `Microphone allowed`, `Search optional`, `Profile incomplete`. |
| P1 | Back/close behavior drawer-based ہے، مگر route-level settings navigation نہیں۔ | Deep section میں پہنچ کر user کو context یا back stack نہیں ملتا۔ | Mobile پر full-screen Settings route with sticky back; desktop پر drawer رکھ سکتے ہیں۔ |
| P1 | Voice, language, persona, country/timezone اور business profile concepts overlap کرتے ہیں۔ | User نہیں جانتا AI response language، UI language، voice language اور region کہاں بدلنا ہے۔ | Labels explicitly rename کریں: `AI response language`, `Voice`, `Business country`, `Time zone`, `Frontend display language`. |
| P2 | Advanced triggers and desktop automation settings visible ہیں چاہے user mobile پر ہو۔ | Mobile user کو irrelevant options دکھتے ہیں۔ | Platform-aware sections: Android پر desktop-only settings hide یا explain کریں۔ |
| P2 | Danger section same long scroll میں ہے۔ | Destructive actions accidental proximity میں آ سکتے ہیں۔ | Danger zone separate bottom route with re-auth/confirmation. |

## 12. Loading, error, empty, and success states

| State | موجودہ risk | User impact | Recommended standard |
|---|---|---|---|
| Loading | API/voice/model tests میں stages compact message میں آ سکتی ہیں۔ | App stuck محسوس ہو سکتی ہے۔ | Always show spinner + named stage + elapsed/timeout guidance + cancel/retry where possible۔ |
| Error | Technical error hints sometimes direct server/provider language میں ہیں۔ | Non-technical user cause نہیں سمجھتا۔ | Every error: `What happened`, `Why`, `Fix now`, `Try again`, `Use alternative`۔ |
| Empty | Chat, Notes, History, Memories اور Dashboard empty states مختلف quality کے ہیں۔ | User کو next action inconsistent ملتا ہے۔ | Every empty state includes one sentence explanation + primary CTA + optional example۔ |
| Success | Save/apply/test success کبھی toast یا short text تک محدود ہے۔ | Completion confidence کم ہوتی ہے۔ | Persistent inline success state, timestamp, next action and undo where destructive۔ |
| Offline/timeout | Offline-first data exists conceptually، مگر network failure states user journey میں central نہیں۔ | User کو معلوم نہیں local features کیا کام کریں گے۔ | Offline banner: `Your local notes/reminders still work. AI actions will retry when online.` |

## 13. Mobile navigation, touch, overflow, and accessibility

| Priority | مسئلہ | User کو مشکل | بہتر طریقہ |
|---|---|---|---|
| P1 | Home header میں کئی compact icon actions ہیں؛ labels small screens پر hide ہو سکتے ہیں۔ | Icon meaning نئے user کے لیے unclear ہو سکتا ہے۔ | First use پر labels دکھائیں، پھر compact mode؛ bottom navigation یا labeled overflow menu consider کریں۔ |
| P1 | Drawer headers میں multiple actions ایک row میں ہیں۔ | 320–360px screens پر cramped layout۔ | Primary close + overflow menu pattern۔ |
| P1 | Many text inputs use small `text-xs` styling. | Mobile reading and form scanning harder۔ | Form labels 13–14px, inputs 16px to avoid iOS zoom and improve readability۔ |
| P2 | Native checkboxes/icons can be smaller than ideal visual target even when parent row is tappable. | Direct icon tap difficult؛ accidental misses۔ | 44px wrapper label with visible 20px control۔ |
| P2 | `truncate` on reminder titles, model IDs, thread metadata can hide important context. | User cannot identify item without opening it۔ | Two-line clamp + detail expansion۔ |
| P2 | Long horizontal metadata strings use separators. | Narrow phones پر wrap awkward ہو سکتی ہے۔ | Convert metadata to stacked chips/rows۔ |
| P3 | Safe-area and touch targets improved, but physical Android keyboard, back gesture, rotation, landscape and WebView versions remain unverified. | Production device behavior can differ from browser preview. | Test matrix: 320px Android, 375px Android, Samsung WebView, keyboard open, permission denied, offline, landscape, Android back۔ |

## Beginner-first target flow

Alpha کو beginner کے لیے اس simplified flow پر لانا چاہیے:

`Open app → See “What do you want done?” → Choose Voice or Text → If not connected, one setup card appears → Paste Gemini key → Test → Allow microphone or choose text → Run one example → See result → If action is external, review one clear approval card → Approve → See honest completion state.`

Business setup کو اس کے بعد رکھا جائے:

`Dashboard → Complete 3-field business profile → Add first reminder → Choose optional recurrence → See today’s priority.`

Advanced controls کو default path سے ہٹا کر یہاں رکھیں:

`Settings → Advanced → model selection, wake triggers, auto-open, performance, theme, privacy, desktop-only controls.`

## Prioritized implementation roadmap

### P0 — trust and completion blockers

1. Voice state machine کو visible labels کے ساتھ implement کریں۔
2. API setup کو staged progress اور categorized recovery میں تبدیل کریں۔
3. Approval card میں complete payload، destination اور explicit next result دکھائیں۔
4. External action lifecycle کو honest status کے ساتھ record کریں: Alpha opened the app, not necessarily sent the message۔
5. Settings کو beginner setup اور advanced configuration میں split کریں۔

### P1 — activation and mobile conversion

1. Home پر contextual examples اور text fallback واضح کریں۔
2. Onboarding میں setup checklist اور post-settings continuation شامل کریں۔
3. Dashboard quick actions کو prefilled command intents سے connect کریں۔
4. Business Profile میں required/optional fields، save status، overdue priority اور reminder notification explanation شامل کریں۔
5. Chat/Notes/History drawers کے headers کو primary action + overflow menu pattern میں simplify کریں۔
6. Empty states کو CTA-based standardized component بنائیں۔
7. API status card میں last test, latency, capabilities اور clear local/server distinction دکھائیں۔

### P2 — polish and retention

1. Notes اور Memories کے roles واضح کریں، tags/examples/export/undo شامل کریں۔
2. Dashboard کو “Today’s priority” اور overdue sections کے ساتھ action-oriented بنائیں۔
3. Long metadata کو chips/stacked rows میں بدلیں۔
4. Form typography کو 16px inputs اور stronger labels کے ساتھ standardize کریں۔
5. Toast-only success states کو persistent inline states میں تبدیل کریں۔
6. User-visible settings search یا section index شامل کریں۔

### P3 — device QA and accessibility

1. Real Android devices پر 320px/375px portrait، landscape، keyboard، permission denial، offline اور back gesture test کریں۔
2. Screen reader labels، focus order، visible focus ring، reduced motion اور contrast test کریں۔
3. Visual regression screenshots for Home, Settings, Dashboard, Business Profile, Chat and API setup رکھیں۔
4. Android release APK میں final frontend build embed/sync کر کے versioned smoke test کریں۔

## Final assessment

Alpha کا current UI بنیادی طور پر کام کرنے کے قابل ہے اور کئی visual/mobile issues پہلے ہی بہتر کیے جا چکے ہیں۔ مگر premium, beginner-friendly SaaS بننے کے لیے سب سے ضروری اگلا کام مزید controls شامل کرنا نہیں بلکہ **steps کم کرنا، next action واضح کرنا، technical complexity چھپانا، اور ہر async state کو honest feedback دینا** ہے۔ اگر P0 اور P1 items implement کر دیے جائیں تو user کو app سمجھنے کے لیے developer-level knowledge کی ضرورت بہت کم ہو جائے گی۔
