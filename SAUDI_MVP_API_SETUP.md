# Saudi-first Alpha MVP: API and environment setup

## Recommended provider stack

| Capability | Provider in this MVP | Server environment variable | Purpose |
|---|---|---|---|
| Multilingual chat, summaries, intent reasoning and action planning | Google Gemini 2.5 Flash through the Lovable AI gateway | `LOVABLE_API_KEY` | Primary text intelligence for Urdu, Arabic, English and additional languages |
| Speech-to-text | Deepgram Nova-3 | `DEEPGRAM_API_KEY` | Browser microphone transcription with short-lived server-minted tokens |
| Realtime audio | Gemini Live adapter (optional) | `GEMINI_API_KEY` | Low-latency voice mode; keep disabled until server-side proxy and usage limits are finalized |
| Web research | Existing server-side web-search function | Provider-specific server configuration | Search and source-backed answers |

## Vercel setup

Add the required values in the Vercel project environment settings for **Preview** and **Production**. Never commit the values to Git, put them in a browser bundle, or store them in `localStorage` for the SaaS product.

The minimum production configuration is:

```text
LOVABLE_API_KEY=your_server_key
DEEPGRAM_API_KEY=your_server_key
LOVABLE_MODEL=google/gemini-2.5-flash
```

`GEMINI_API_KEY` is optional for the current MVP. It should only be enabled when realtime audio is deliberately turned on and its quotas, consent, and server proxy are in place.

## Supported languages

The current language preference supports automatic detection, English, Urdu, Arabic, Hindi, Turkish, French and Spanish. Deepgram uses multilingual recognition for non-English speech; the response model receives an explicit language policy so text replies follow the selected language.

## Security boundary

All provider secrets stay on the server. The browser receives only short-lived Deepgram tokens or status metadata. Any action that sends, deletes, publishes, purchases, transfers money, or changes an external account must be represented as a pending action and require explicit approval before execution.

## Launch checklist

1. Configure `LOVABLE_API_KEY` and `DEEPGRAM_API_KEY` in Vercel.
2. Redeploy Production after saving environment variables.
3. Open Settings → AI APIs and confirm LLM and Speech to text show **Ready**.
4. Test one text request in English, one in Urdu, one in Arabic, and one microphone request.
5. Set provider usage limits and error alerts before inviting paying customers.
6. Add authentication, database persistence, billing and OAuth integrations before exposing customer data to a multi-user SaaS.
