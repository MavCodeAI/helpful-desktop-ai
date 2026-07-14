# perfect1 کے Features port کرنے کا Plan

سب features ایک ساتھ add کرنا practical نہیں — build خراب ہو سکتا ہے اور test مشکل۔ اس لیے **3 phases** میں تقسیم، ہر phase الگ سے verify ہو گا۔

---

## Phase 1 — Quick Wins (فوری value، کم risk)

**1. MicLevelMeter** — live mic input bar
- `src/components/realtime/MicLevelMeter.tsx` port
- `MainStage` / `SettingsDrawer` میں show

**2. OfflineBanner** — network detection
- `src/components/realtime/OfflineBanner.tsx` port
- `__root.tsx` میں mount

**3. Web Search Cache** — repeated queries fast
- `src/lib/web-search-cache.ts` port
- `web-search.functions.ts` کو cache use کرنے کیلئے wire

**4. intents.test.ts** — unit tests baseline

---

## Phase 2 — Settings Reorganization

perfect1 کا modular settings structure adopt:
- `LanguageSection` (persona سے alag)
- `MemorySection` (persona سے alag)
- `ThemeSection` — theme switcher (light/dark/system)
- `LayoutSection` — layout switch (classic vs cockpit)
- `ApiKeysSection` + `/api-settings` route + `api-test.functions.ts`
- `DangerSection` — clear all data / reset
- `SectionHeader` shared component
- `AdvancedSection` — power-user toggles

موجودہ `PersonaSection` کو صرف persona-specific fields تک محدود کریں۔

---

## Phase 3 — Cockpit Layout (بڑا feature)

Desktop-style multi-pane UI as **optional** layout (Layout setting سے switch):
- `src/components/realtime/cockpit/AppSidebar.tsx` — left nav
- `TopBar.tsx` — status + quick actions
- `CenterStage.tsx` — main conversation area
- `ContextRail.tsx` — right pane (memories/notes/context)
- Shadcn `SidebarProvider` wrapper
- User Layout setting سے **Classic MainStage** یا **Cockpit** choose کر سکے

**News feature** (`NewsSection` + `news-prefs.ts`) — optional، اگر آپ چاہیں تو Phase 3 میں شامل، ورنہ skip۔

---

## Technical Notes

```text
Files to port from perfect1 → current project:
Phase 1:
  src/components/realtime/MicLevelMeter.tsx
  src/components/realtime/OfflineBanner.tsx
  src/lib/web-search-cache.ts
  src/lib/intents.test.ts
  (edit) src/lib/web-search.functions.ts    — wire cache
  (edit) src/routes/__root.tsx              — mount OfflineBanner
  (edit) src/components/realtime/MainStage.tsx — mount MicLevelMeter

Phase 2:
  src/components/realtime/settings/{SectionHeader,LanguageSection,MemorySection,ThemeSection,LayoutSection,ApiKeysSection,DangerSection,AdvancedSection}.tsx
  src/lib/api-test.functions.ts
  src/routes/api-settings.tsx
  (edit) src/components/realtime/SettingsDrawer.tsx
  (edit) src/components/realtime/settings/PersonaSection.tsx

Phase 3:
  src/components/realtime/cockpit/{AppSidebar,TopBar,CenterStage,ContextRail}.tsx
  src/lib/realtime/layout-pref.ts           — classic|cockpit setting
  (edit) src/routes/index.tsx               — conditional render
  Optional: NewsSection + news-prefs.ts
```

Each phase alag turn میں ship ہو گا، build green رکھتے ہوئے۔

---

## سوال

- کیا **Phase 1** سے شروع کروں (4 quick wins)؟
- یا کوئی خاص feature پہلے چاہیے (مثلاً Cockpit layout، ApiKeys page)؟
- News feature include کروں یا skip؟
