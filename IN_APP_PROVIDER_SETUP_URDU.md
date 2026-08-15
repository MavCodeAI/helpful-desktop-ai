# Alpha: Settings کے اندر Provider Setup اور Test

## مقصد

Alpha کی Settings میں اب Gemini Live کے لیے **Apply & Test** flow موجود ہے۔ اس flow سے user key paste کر کے پہلے server-side Gemini model connection test کر سکتا ہے، پھر ایک حقیقی short-lived Gemini Live session token بھی verify کر سکتا ہے۔ صرف دونوں checks کامیاب ہونے کے بعد key device settings میں apply ہوتی ہے۔

## استعمال کا طریقہ

1. Alpha app کھولیں اور **Settings** کھولیں۔
2. **AI APIs → Provider setup & test** پر جائیں۔
3. Google AI Studio سے حاصل کردہ `GEMINI_API_KEY` password field میں paste کریں۔
4. **Apply & Test** دبائیں۔
5. App live progress دکھائے گی: model test، پھر Gemini Live session-token test۔
6. کامیابی پر green confirmation آئے گا اور microphone voice session اسی key کے ساتھ چل سکے گا۔ ناکامی پر red result میں HTTP status/hint دکھے گا؛ key apply نہیں ہوگی۔

## کون سے tests ہوتے ہیں؟

| Test | کیا verify ہوتا ہے |
|---|---|
| Gemini model probe | key valid ہے اور کم از کم `gemini-2.5-flash` model قابلِ رسائی ہے |
| Gemini Live token | key سے short-lived Live session token واقعی issue ہو سکتا ہے |
| Voice start | Apply کے بعد voice session وہی user key یا server key استعمال کرتا ہے |

## Security boundary

Key براہِ راست browser سے Google کو نہیں بھیجی جاتی۔ Settings کا server function key کو provider request کے لیے استعمال کرتا ہے اور واپس صرف test result یا short-lived session token آتا ہے۔ Live MVP میں key اسی device کی local settings میں محفوظ رہتی ہے؛ اسے public URL، GitHub، logs یا Android APK source میں شامل نہ کریں۔ Team/production کے لیے مستقل key اب بھی Vercel Environment Variable `GEMINI_API_KEY` میں رکھنی چاہیے۔

**اہم:** یہ in-app key setup authenticated multi-user secret vault نہیں ہے۔ SaaS launch سے پہلے account-based encrypted secret storage، per-user access control، key rotation اور audit logging شامل کرنا ضروری ہے۔

## Result کا مطلب

- **Success:** models اور Live token دونوں کام کر رہے ہیں؛ key apply ہو گئی۔
- **Key rejected / 401 یا 403:** key غلط، revoked، غیر متعلقہ Google project سے وابستہ، یا API access محدود ہے۔
- **404:** منتخب model اس key کے لیے دستیاب نہیں۔
- **429:** rate limit؛ کچھ دیر بعد دوبارہ test کریں۔
- **Network error:** Vercel function یا internet/provider connectivity check کریں۔

## Clear

**Clear** صرف اس device کی locally applied key صاف کرتا ہے۔ Vercel میں محفوظ server-side `GEMINI_API_KEY` خود delete نہیں ہوتی۔

## Code contract

- `testProviderConnection` model probe اور result status دیتا ہے۔
- `getGeminiLiveToken` optional `userKey` قبول کرتا ہے اور secret واپس نہیں کرتا۔
- `useVoiceSettings.applyGeminiKey` successful test کے بعد local voice state، provider readiness اور session reset update کرتا ہے۔
