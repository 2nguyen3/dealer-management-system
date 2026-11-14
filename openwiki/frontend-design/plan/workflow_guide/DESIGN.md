# Workflow guide — design

## Modules

| Path                                                  | Role                                                                                    |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `src/lib/i18n/core.ts`                                | `msg()` marks Vietnamese message IDs; `t()` translates with `{name}` params and plurals |
| `src/lib/errors.ts`                                   | `ERROR_TEXTS` code → `{message, hint, action}`; `describeError(code)` translates        |
| `src/lib/api.ts`                                      | `ApiError` gains `hint`/`action`; known codes show catalogue text, not server text      |
| `src/components/guide/steps.ts`                       | `StepState` (`done/current/blocked/todo/skipped`) and written state labels              |
| `src/components/guide/WorkflowSteps.tsx`              | Focusable horizontal rail with a tooltip per step (`data-testid="workflow-steps"`)      |
| `src/components/guide/NextActionCallout.tsx`          | "Việc cần làm tiếp": link/action, or "Chờ {role} thực hiện." without permission         |
| `src/components/guide/LockedButton.tsx`               | Disabled button + tooltip + `aria-describedby` reason (`data-locked-reason`)            |
| `src/components/guide/notifyNextStep.ts`              | Sonner toast on the `guide` toaster (bottom-right, 6 s, "Mở" when allowed)              |
| `src/components/guide/preferences.ts`                 | `agentra-next-step-hints` switch (`useSyncExternalStore`, storage-failure safe)         |
| `src/components/guide/ErrorNotice.tsx`                | Error alert plus the code's resolving link (target overridable per screen)              |
| `src/components/guide/SafeLink.tsx`                   | Router `Link` inside a router, plain anchor outside (isolated page renders)             |
| `src/features/guide/content/*.ts`                     | 29 route guides, every string wrapped in `msg()`                                        |
| `src/features/guide/GuideButton.tsx`, `GuideSheet.tsx` | Button in `PageHeader` tools; sheet lazy-loaded on first open; left side in RTL         |
| `src/features/guide/workflows.ts`                     | Pure "server state → steps / next / locks / effects" models per workflow                |
| `src/features/guide/useUpfrontState.ts`               | State of the current revision's upfront confirmation (`GET /upfront-confirmations/{id}`) |

## State sources (read from the backend, not guessed)

- Document status `DRAFT/PENDING/POSTED/CANCELLED`; revision state `DRAFT/READY/POSTED`.
- Stock issue submit → `PENDING/READY`; posting needs a VERIFIED confirmation whose
  amount equals `immediatePayment` (`UPFRONT_REQUIRED`); replace-pending is refused with
  `UPFRONT_CONFLICT` once a VERIFIED confirmation exists; receive-separately turns the
  money into a `RECEIVED_UNAPPLIED` receipt (`RECEIVED_SEPARATELY`).
- Detail `upfrontConfirmationId` belongs to the current revision. While its state loads
  (`UNKNOWN`) the UI predicts nothing that could block a valid server action.

## Placement

`ShellLayout` provides `PageToolsContext` (GuideButton) to `PageHeader`; Home and Profile
render the tools themselves. `App` mounts a second `<Toaster id="guide" position="bottom-right">`
so guidance never covers the normal top-right feedback.
