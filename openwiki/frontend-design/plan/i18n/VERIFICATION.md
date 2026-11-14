# Interface languages — verification

## Phase ② gate — 2026-11-14 (from `ui/`)

| Command                | Result                                                                  |
| ---------------------- | ----------------------------------------------------------------------- |
| `npm run lint`         | pass (0 warnings)                                                       |
| `npm run typecheck`    | pass                                                                    |
| `npm test`             | 59 files / 725 tests passed (phase ① baseline 57 / 679)                 |
| `npm run format:check` | pass                                                                    |
| `npm run build`        | pass; one lazy chunk per catalogue (e.g. `en` / `ar` / `my` separate)   |

Scope change: on 2026-11-14 the user reduced the language list from 48 to 24. Catalogues for
the 23 non-source languages each hold all 2,267 messages; `i18n_catalogs.test.ts` checks every
one for missing/extra keys and placeholders. A scan for Vietnamese letters left in
translations finds only the example name "Đại lý Minh Phát", "VNĐ" and "đồng".

New test files: `i18n_runtime.test.tsx` (19), `i18n_catalogs.test.ts` (3 + 23 per locale);
`i18n_core.test.ts` updated for 24 locales / two RTL.

Not verified in this phase: real-browser rendering of RTL and non-Latin scripts (release smoke).
