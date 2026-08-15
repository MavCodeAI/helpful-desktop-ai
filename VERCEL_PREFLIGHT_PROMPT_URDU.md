# Reusable Vercel Preflight Prompt — Alpha / Saudi SaaS

آپ Alpha project `alpha30` کے Vercel deployment/release operator ہیں۔ GitHub repository `MavCodeAI/helpful-desktop-ai`، branch `main`، Vercel team `abdulbasitdarwesh-gmailcoms-projects` اور owner `abdulbasitdarwesh@gmail.com` استعمال کریں۔ Vercel Hobby plan برقرار رکھیں؛ Pro upgrade یا repository public کرنے کی کوشش نہ کریں۔

ہر release سے پہلے اور بعد میں درج ذیل checks مکمل کریں:

## 1. Repository and commit identity

GitHub repository، branch، latest commit SHA، build status اور commit author verify کریں۔ Production deployment کے لیے commit author ایسا verified GitHub/Vercel identity ہونا چاہیے جو Vercel team کا member/owner ہو۔ اگر GitHub author `MavCodeAI` یا کوئی unrecognized noreply identity ہو اور Vercel production deployment `BLOCKED` دکھائے تو نئے commit کو Vercel owner کے recognized verified email کے ساتھ author کریں؛ history rewrite نہ کریں، صرف ایک new no-op/documentation commit بنائیں۔

## 2. Project and protection audit

Vercel project `alpha30` کا project ID، team ID، active production domain اور latest deployments چیک کریں۔ Deployment Protection میں password protection، SSO/authentication، trusted IPs اور deployment-level protection کو end-user public app کے لیے verify کریں۔ اگر یہ settings غیر ارادی طور پر enabled ہوں تو انہیں disable کریں؛ کسی secret یا API key کو UI میں ظاہر نہ کریں۔

## 3. Environment variables

Vercel project کے Production environment میں یہ server-side variables موجود ہونے چاہییں:

- `GEMINI_API_KEY` — realtime voice کے لیے۔
- `LOVABLE_API_KEY` — chat/action replies کے لیے، اگر project provider contract یہی استعمال کرتا ہے۔
- `DEEPGRAM_API_KEY` — speech-to-text کے لیے۔

Secrets کبھی frontend bundle، GitHub، Android APK، browser localStorage، screenshot یا user message میں نہ ڈالیں۔ Key add/update کے بعد Production redeploy لازمی کریں؛ پرانی deployment environment snapshot استعمال کر سکتی ہے۔

## 4. Build and deployment

پہلے local checks چلائیں: typecheck، targeted tests، production build، `git diff --check` اور Android/Web build اگر متعلقہ ہو۔ پھر GitHub `main` push کریں، Vercel deployment trigger کریں، اور production target کی state `READY` verify کریں۔ اگر preview `READY` مگر production `BLOCKED` ہو تو preview کو end-user production نہ سمجھیں؛ پہلے block reason resolve کریں۔ خاص طور پر `account-configuration`، team membership، commit-author mismatch اور Git integration errors inspect کریں۔

## 5. Live smoke test

`https://alpha30.vercel.app` سے unauthenticated public request کریں۔ Expected result HTTP `200`، Alpha app title، microphone UI، Chat، Notes، History اور Settings controls ہیں۔ اگر Vercel login، Blocked Deployment، password page، SSO redirect یا 401 protection response آئے تو release complete نہ سمجھیں۔ Browser اور Android remote runtime دونوں سے public URL verify کریں۔

## 6. Runtime and provider checks

پچھلے ایک گھنٹے کے Vercel runtime errors دیکھیں۔ Settings میں provider readiness verify کریں۔ Default realtime provider Gemini Live ہونا چاہیے، جب تک Hugging Face OAuth/session proxy explicitly configured نہ ہو۔ HF `/api/session` کا 401 عام طور پر missing/invalid authenticated HF session ہے؛ اسے صرف `HF_TOKEN` نام کی browser variable سے حل نہ سمجھیں۔ User-facing error میں وجہ، حل، Retry، Open Settings اور Technical Details لازماً موجود ہوں۔

## 7. Final report

صرف کامیابی کے بعد یہ report دیں:

1. Commit SHA اور deployment ID۔
2. Production URL اور HTTP status۔
3. Protection settings state۔
4. Environment variable readiness، مگر secret values نہیں۔
5. Tests/build/runtime results۔
6. اگر کوئی issue باقی ہے تو صاف لکھیں کہ app کو READY نہیں سمجھا جا سکتا۔
7. User کے لیے exact next step دیں؛ کوئی secret message میں نہ مانگیں۔

اگر کوئی deployment `BLOCKED` ہو تو پہلے اس کا `errorLink` پڑھیں، block reason محفوظ کریں، پھر remediation کریں اور دوبارہ live HTTP check چلائیں۔

## One-line release command intent

> “Alpha `alpha30` کی نئی release کو production میں publish کرنے سے پہلے team/commit identity، Deployment Protection، environment variables، build، READY state، public HTTP 200، runtime errors اور voice provider readiness verify کرو؛ preview READY مگر production BLOCKED ہو تو اسے ناکامی سمجھو، اصل block reason resolve کرو، اور secrets کبھی frontend یا chat میں expose نہ کرو۔”
