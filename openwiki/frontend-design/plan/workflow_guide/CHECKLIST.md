# Workflow guide — checklist

- [x] Message infrastructure (`msg`/`t`) used by every new string
- [x] Error catalogue for all §3.3 codes and the re-scan codes; `ApiError.hint/action`
- [x] `WorkflowSteps`, `NextActionCallout`, `LockedButton`, `ErrorNotice`, `SafeLink`
- [x] `notifyNextStep` bottom-right toaster and the `/profile` switch
- [x] Guide button on every page; 29 guides incl. `/`, `/profile`, `/chatbot`, `/document-history`
- [x] Stock issue ↔ upfront: rail, locked Ghi sổ, deep link, replace warnings, post effects
- [x] Rails/notices on receipts, returns, adjustments, counts, payments, credit, refunds,
      online payments, corrections, business rules, master data, permissions, reports
- [x] Tests for every new symbol (see TESTS.md)
- [x] Phase ① gate: lint, typecheck, test, format:check, build
- [ ] Optional "Việc chờ bạn xử lý" (deferred: list endpoints expose no totals)
- [ ] Real-browser check of the guide (release step, see VERIFICATION)
