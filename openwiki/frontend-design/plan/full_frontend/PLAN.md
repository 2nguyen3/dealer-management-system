# Full frontend — Plan

**Prepared:** 2026-10-03. **Status:** planning + static wireframes; no business frontend implementation. The [General Plan](../../GENERAL_PLAN.md) controls dependencies and [General Checklist](../../GENERAL_CHECKLIST.md) tracks evidence.

## Destination

Build Agentra's complete internal, Vietnamese-first dealer operations interface using the single [target API](../../../backend-design/API/openapi.json), [Q01–Q15](../../../database-design/business_decision_making.md) and current React 19/Vite/strict-TypeScript/plain-CSS starter. There are **32 paired child plans**, **154 unique target operations** (153 employee/browser-facing; one server-to-server webhook), and actual multi-page [wireframes](../../wr/index.html). Only the seven authentication operations and two non-target health endpoints are currently mounted.

## Reading and ownership

Read REQUIREMENTS → OPERATIONS → MODULES → DESIGN → DECISIONS → EXECUTION → WIREFRAMES → TESTS → CHECKLIST → VERIFICATION, then the owning six-file child and its paired HTML. The exact API schema lives only in backend-design/API/openapi.json. Use the backend [full operation inventory](../../../backend-design/plan/full_backend/OPERATIONS.md) for First/Full gates and [release handoff](../../../backend-design/plan/full_backend/EXECUTION.md) for persisted-kind/deployment readiness.

## Delivery ladder

1. Paired detailed plan + wireframes: screens, actions, source permissions and recovery states reconciled.
2. F01 shared transport/validation/routing/test tooling; F02 real authentication; F03 permission-aware shell.
3. Administrative and master-data features independently integrate their published operations.
4. Document and money flows implement mocks and shared patterns early, but live full operation gates wait for M28/M29 and backend R5 where required.
5. History/corrections then five reports, permission-aware dashboard and chatbot; backend R6 and isolated live-browser evidence.

Planning evidence, contract-mocked behavior, live integration and full-module completion are distinct. A clickable static action demonstrates a proposed interaction only; it never updates debt, stock or payment provider state.
