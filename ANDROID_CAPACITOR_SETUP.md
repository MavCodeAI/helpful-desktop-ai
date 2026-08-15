# Alpha Native Android APK Setup

## خلاصہ

Alpha کو Capacitor 8 کے ذریعے native Android shell میں package کیا گیا ہے۔ APK کا application ID `com.mavcodeai.alpha` ہے، app name `Alpha` ہے، اور native shell موجودہ multilingual Vercel assistant کو secure HTTPS connection کے ذریعے load کرتا ہے۔ اس design سے AI keys APK میں شامل نہیں ہوتیں؛ chat، multilingual routing، provider health اور safety policy server-side رہتے ہیں۔

Capacitor کی documented workflow کے مطابق موجودہ web app کے لیے ایک valid web asset directory، Android platform project، native plugins اور Gradle build شامل کیے گئے ہیں۔ موجودہ TanStack Start app SSR/server-function based ہے، اس لیے APK کے لیے production `server.url` strategy استعمال کی گئی ہے؛ `android-web/index.html` valid fallback asset ہے، جبکہ runtime live Vercel origin سے app load کرتا ہے۔

## تیار APK

| Artifact | تفصیل |
|---|---|
| `android/app/build/outputs/apk/debug/app-debug.apk` | Installable debug APK، تقریباً 5.6 MB |
| Package ID | `com.mavcodeai.alpha` |
| Version | `1.0` / versionCode `1` |
| Compile/target SDK | Android API 36 |
| Minimum SDK | Android API 24، یعنی Android 7.0 یا بعد |
| Voice permission | `android.permission.RECORD_AUDIO` شامل ہے |
| SHA-256 | `a744f54ea2dfc0fb0960e7094ca1913a5e379ee5ccd02bca1b20dd8e8fff35e0` |

## APK install کرنا

Android phone پر APK منتقل کر کے file manager سے install کریں۔ اگر Android “Install unknown apps” permission مانگے تو اسی file manager یا browser کے لیے permission enable کریں، پھر installation مکمل کریں۔ پہلی voice interaction پر microphone permission کو **Allow** کریں۔ APK چلنے کے لیے internet ضروری ہے کیونکہ production build live Vercel backend اور server functions استعمال کرتا ہے۔

Developer machine سے install کرنے کے لیے Android USB debugging enable کریں، phone connect کریں، پھر یہ command چلائیں:

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

## Native Android work جو شامل ہے

| حصہ | implementation |
|---|---|
| Capacitor shell | `capacitor.config.ts`، Android project اور Gradle integration |
| Native identity | `com.mavcodeai.alpha` package ID، Alpha label اور branded launcher icons |
| Voice boundary | Microphone، audio settings اور vibration permissions |
| Mobile UX | Android keyboard body resize، dark status bar، safe-area compatible web layout |
| Lifecycle | App background ہوتے ہی realtime microphone session stop کرنے والا listener |
| Tactile feedback | Voice start، stop اور error states کے لیے Android haptics |
| Native plugins | App، Haptics، Keyboard، Preferences، Push Notifications اور Status Bar |
| Platform UI | Android میں Electron-only download instructions اور Windows auto-launch controls hide/relabeled ہیں |

## Build commands

Web bundle، Capacitor sync اور debug APK ایک command سے بنانے کے لیے project root میں یہ command چلائیں:

```bash
pnpm run android:build:debug
```

Native Android project Android Studio میں کھولنے کے لیے:

```bash
pnpm run android:open
```

اگر staging یا کسی دوسرے Vercel deployment کو APK میں load کرنا ہو تو build سے پہلے `CAPACITOR_SERVER_URL` set کریں:

```bash
CAPACITOR_SERVER_URL=https://your-staging-domain.vercel.app pnpm run android:build:debug
```

## ضروری production configuration

APK میں کسی بھی AI provider secret کو hard-code نہیں کیا گیا۔ Live AI responses کے لیے Vercel project `alpha9in` میں server-side environment variables configured ہونے چاہییں۔ بنیادی chat کے لیے `LOVABLE_API_KEY`، live transcription کے لیے `DEEPGRAM_API_KEY`، اور optional Gemini realtime voice کے لیے `GEMINI_API_KEY` درکار ہیں۔ اگر provider key موجود نہ ہو تو app crash نہیں کرتا؛ وہ sanitized configuration message دکھاتا ہے۔

Native debug APK testing کے لیے یہ build functional ہے، مگر Play Store یا public customer distribution کے لیے الگ production signing keystore، release AAB، privacy policy، Play Data Safety declaration، crash monitoring، authentication اور billing configuration ابھی ضروری ہیں۔ موجودہ APK ایک **pilot/test build** ہے، final store release نہیں۔

## Known limitations

Android WebView میں desktop کے arbitrary local files، Windows programs، tray controls اور global hotkeys available نہیں ہوں گے۔ Gmail، Calendar، web search، notes، reminders، customer reply drafts اور approval-based workflows shared server APIs کے ذریعے mobile پر بنائے جا سکتے ہیں، مگر ہر external integration کے لیے official OAuth/API permissions درکار ہوں گی۔ Push notification plugin شامل ہے، لیکن production push delivery کے لیے Firebase project، Android app signing، notification token registration اور backend notification service ابھی configure کرنا باقی ہیں۔

موجودہ APK کا runtime live Vercel app پر منحصر ہے۔ اگر Vercel URL بدل جائے تو اگلا APK `CAPACITOR_SERVER_URL` کے ساتھ rebuild کرنا ہوگا۔ Offline chat، cloud account sync، encrypted cloud history، team workspaces، Saudi billing اور full Arabic RTL ابھی next product phase ہیں۔

## Verification

Automated verification میں Urdu/Arabic/English intent regression tests کے 14/14 tests pass ہوئے، TypeScript check pass ہوا، production Vite/TanStack build pass ہوا، Capacitor sync pass ہوا، Gradle `assembleDebug` pass ہوا، اور generated APK metadata میں package ID، Alpha label، internet permission اور microphone permission verify ہوئے۔ Sandbox میں physical Android device یا emulator connected نہیں تھا، اس لیے final hardware microphone test ابھی user device پر کرنا ہوگا۔

## References

[1]: https://capacitorjs.com/docs/getting-started "Capacitor Getting Started"
[2]: https://capacitorjs.com/docs/basics/workflow "Capacitor Development Workflow"
[3]: https://capacitorjs.com/docs/android "Capacitor Android Documentation"
[4]: https://capacitorjs.com/docs/config "Capacitor Configuration"
