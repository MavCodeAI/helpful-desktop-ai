import { describe, it, expect } from "vitest";
import { detectIntent, matchNoteIntent } from "./intents";

describe("detectIntent — core intents", () => {
  it("detects timer", () => {
    const i = detectIntent("set a 5 minute timer");
    expect(i?.kind).toBe("timer");
    expect(i?.action?.type).toBe("timer");
  });

  it("detects Urdu timer", () => {
    expect(detectIntent("5 minute ka timer")?.kind).toBe("timer");
  });

  it("detects open app", () => {
    expect(detectIntent("open gmail")?.kind).toBe("open");
    expect(detectIntent("gmail kholo")?.kind).toBe("open");
  });

  it("detects google search", () => {
    const i = detectIntent("google typescript generics");
    expect(i?.kind).toBe("search");
    expect(i?.url).toMatch(/^https:\/\/www\.google\.com/);
  });

  it("detects Arabic search and open commands", () => {
    expect(detectIntent("ابحث عن الطقس في الرياض")?.kind).toBe("search");
    expect(detectIntent("افتح جوجل")?.kind).toBe("open");
  });

  it("detects Arabic timer", () => {
    const i = detectIntent("مؤقت 5 دقائق");
    expect(i?.kind).toBe("timer");
    expect(i?.action?.type).toBe("timer");
  });

  it("detects weather", () => {
    expect(detectIntent("weather in karachi")?.kind).toBe("weather");
  });

  it("detects Urdu news command", () => {
    const i = detectIntent("نیوز سناؤ");
    expect(i?.kind).toBe("news");
    expect(i?.action).toEqual({ type: "news", query: "latest news" });
  });

  it("detects Arabic news command", () => {
    expect(detectIntent("آخر الأخبار")?.action?.type).toBe("news");
  });

  it("extracts an English news topic", () => {
    expect(detectIntent("news about Riyadh business")?.action).toEqual({ type: "news", query: "riyadh business" });
  });

  it("detects screen-vision", () => {
    expect(detectIntent("screen dekho")?.action?.type).toBe("screen-vision");
    expect(detectIntent("what's on my screen")?.action?.type).toBe("screen-vision");
  });

  it("detects ai-answer", () => {
    const i = detectIntent("ai se poocho what is quantum entanglement");
    expect(i?.action?.type).toBe("ai-answer");
  });

  it("detects native desktop context actions", () => {
    expect(detectIntent("active window batao")?.action?.type).toBe("active-window");
    expect(detectIntent("global hotkey batao")?.action?.type).toBe("hotkey-status");
    expect(detectIntent("screenshot le lo")?.action?.type).toBe("screenshot");
  });

  it("detects default browser opening", () => {
    const i = detectIntent("open browser");
    expect(i?.kind).toBe("open");
    expect(i?.url).toBe("https://www.google.com");
  });

  it("returns null for empty / chit-chat", () => {
    expect(detectIntent("")).toBeNull();
    expect(detectIntent("hey how are you")).toBeNull();
  });
});

describe("matchNoteIntent", () => {
  it("matches note with colon", () => {
    expect(matchNoteIntent("note: buy milk")).toBe("buy milk");
  });
  it("matches Urdu note", () => {
    expect(matchNoteIntent("yaad rakho meeting 5pm")).toBe("meeting 5pm");
  });
  it("matches Arabic note", () => {
    expect(matchNoteIntent("ملاحظة: اجتماع الساعة 5")).toBe("اجتماع الساعة 5");
  });
  it("returns null for non-notes", () => {
    expect(matchNoteIntent("hello")).toBeNull();
  });
});
