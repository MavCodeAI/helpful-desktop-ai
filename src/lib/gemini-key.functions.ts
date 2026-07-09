import { createServerFn } from "@tanstack/react-start";

export const getGeminiKey = createServerFn({ method: "GET" }).handler(async () => {
  return { key: process.env.GEMINI_API_KEY ?? "" };
});
