# Workflow guide — GUIDE, steppers, next-step toasts, error translation (2026-11-14)

Scope: frontend `ui/` only. No backend, database or API contract change. The server
remains the authority for every state transition; the UI only predicts and explains.

Trigger: on 2026-11-14 a manager submitted PX-778 with an immediate payment, pressed
**Ghi sổ** and got `UPFRONT_REQUIRED` in English. Nothing told them that accounting must
first verify the money on another page. This module makes every business workflow
self-explaining.

| Goal | Outcome                                                                                                   |
| ---- | --------------------------------------------------------------------------------------------------------- |
| G1   | Every workspace page has a **Hướng dẫn** button (lucide `BookOpen`) that opens a route-specific guide     |
| G2   | Each of the 15 business workflows shows a stepper derived from real server state                           |
| G3   | Blocked actions are disabled with a tooltip giving the reason; confirm dialogs state the consequences      |
| G4   | After each successful action a bottom-right toast names the next step and offers **Mở** (≈6 s, can be off) |
| G5   | Every known API error code is shown as `{message, hint, action}` in Vietnamese (and later every locale)    |

Companion files: [REQUIREMENTS](REQUIREMENTS.md) · [DESIGN](DESIGN.md) · [TESTS](TESTS.md) ·
[CHECKLIST](CHECKLIST.md) · [VERIFICATION](VERIFICATION.md).

## Phases

1. Message infrastructure (`src/lib/i18n`, Vietnamese source only) so guide content and
   error texts are written as translatable messages from the start.
2. Error catalogue `src/lib/errors.ts` (111 codes: backend scan + OpenAPI + client codes).
3. Shared components `src/components/guide/`: `WorkflowSteps`, `NextActionCallout`,
   `LockedButton`, `ErrorNotice`, `SafeLink`, `notifyNextStep`, hint preference; route
   guide UI `src/features/guide/GuideButton.tsx` + `GuideSheet.tsx`.
4. Guide content for every route in `routePermissions` plus `/`, `/profile`, `/chatbot`,
   `/document-history`.
5. Workflow models `src/features/guide/workflows.ts` (pure state → steps functions) and
   page integration, stock issue → upfront payment first.
6. Settings toggle "Hiện gợi ý bước tiếp theo" on `/profile`.

Out of scope: a backend preview endpoint for posting consequences (FIFO allocation is
described as a rule, never computed by the UI) and the optional "Việc chờ bạn xử lý" list
(§3.4 of the handoff; list endpoints have no total count, so it is deferred).

## Status (2026-11-14)

Phase ① implemented; gate passed (see [VERIFICATION](VERIFICATION.md)). Strings are written
as Vietnamese message IDs so the i18n module translates them without rework.
