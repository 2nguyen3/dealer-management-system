# Workflow guide — verification

## Phase ① gate — 2026-11-14 (from `ui/`)

| Command                | Result                                         |
| ---------------------- | ---------------------------------------------- |
| `npm run lint`         | pass (0 warnings)                              |
| `npm run typecheck`    | pass                                           |
| `npm test`             | 57 files / 679 tests passed (baseline 52 / 610) |
| `npm run format:check` | pass                                           |
| `npm run build`        | pass (GuideSheet lazy chunk ≈ 60 kB)           |

New test files: `i18n_core.test.ts` (12), `guide_components.test.tsx` (22),
`guide_workflows.test.tsx` (26), `guide_pages.test.tsx` (7), `profile_guide.test.tsx` (2).
`api.test.ts` updated: PRECONDITION_FAILED now shows the catalogue text.

Not verified in this phase: real-browser rendering (covered by the release smoke).
