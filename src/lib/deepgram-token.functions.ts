// Mints a short-lived Deepgram token so browser can open WS without exposing the API key.
import { createServerFn } from "@tanstack/react-start";

export const getDeepgramToken = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ token: string; expiresIn: number }> => {
    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) throw new Error("Live STT is not configured (DEEPGRAM_API_KEY missing).");

    const res = await fetch("https://api.deepgram.com/v1/auth/grant", {
      method: "POST",
      headers: { Authorization: `Token ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ttl_seconds: 60 }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Deepgram auth failed [${res.status}]: ${body}`);
    }
    const json = await res.json();
    const token = json?.access_token as string | undefined;
    const expiresIn = (json?.expires_in as number | undefined) ?? 30;
    if (!token) throw new Error("Deepgram returned no access token.");
    return { token, expiresIn };
  },
);
