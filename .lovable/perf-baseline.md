# Perf Baseline — pre-refactor

تاریخ: 2026-07-09
Build: `bun run build` (clean)

## Client bundle (dist/client/assets, raw bytes)

| فائل | Bytes | KB |
|---|---:|---:|
| index-*.js (main) | 378,288 | 369 |
| **jarvis-*.js (route chunk)** | **347,533** | **339** |
| styles-*.css | 105,418 | 103 |
| license-*.js | 30,870 | 30 |
| jarvis-preview-*.js | 8,090 | 7.9 |
| useMicLevel-*.js | 3,734 | 3.6 |
| routes-*.js | 3,265 | 3.2 |

**Total initial JS پر /jarvis:** ~726 KB raw (main + jarvis chunk). یہ بڑا ہدف ہے۔

## Source complexity

- `src/routes/jarvis.tsx` = **2,879 lines**
- 279 hook/state/function declarations اسی فائل میں
- ایک ہی component، ایک ہی file۔

## SSR chunk

- `dist/server/_ssr/jarvis-*.mjs` = 143 KB (33 KB gz) — SSR side بھی monolithic

## Targets (refactor کے بعد)

| Metric | Baseline | Target |
|---|---:|---:|
| jarvis route chunk | 339 KB | < 200 KB |
| main index chunk | 369 KB | < 300 KB |
| jarvis.tsx lines | 2879 | < 300 |
| ہر feature module | — | < 400 lines |
| Realtime code | eager | lazy (0 KB initial) |

## اگلا موازنہ

ہر step کے بعد `dist/client/assets/` سے یہی اعداد لیں اور اس فائل میں column شامل کریں۔
