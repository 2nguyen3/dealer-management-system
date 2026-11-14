# Portal — verification

## Phase ③ gate — 2026-11-14 (from `ui/`)

| Command                | Result                                                    |
| ---------------------- | --------------------------------------------------------- |
| `npm run lint`         | pass (0 warnings)                                         |
| `npm run typecheck`    | pass                                                      |
| `npm test`             | 61 files / 753 tests passed (phase ② baseline 59 / 725)   |
| `npm run format:check` | pass                                                      |
| `npm run build`        | pass                                                      |

New test files: `portal_favorites.test.ts` (unit: model, storage, tab), `portal_page.test.tsx`
(Portal tabs, deck, picker, hidden entries, storage blocked, `FavoriteButton`).
Updated: `home_page.test.tsx`, `home_cards.test.tsx` (catalogue is now the second tab).
Translations: 27 new messages (22 Portal + 5 guide sentences) for all 23 catalogues; catalogue
test passes with 2,290 messages; obsolete "Bàn làm việc" keys removed.

Not verified in this phase: real-browser drag reordering and layout (release smoke).
