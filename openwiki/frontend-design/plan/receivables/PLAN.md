# F20 — receivables: Plan

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Goal and scope

Read receivables, invoice balances and allocation provenance without client-side FIFO edits. This module owns its feature under `ui/src/features/receivables/` unless its responsibility belongs to shared `ui/src/lib/` or `ui/src/app/`. **Frontend prerequisites:** F19. **Backend gates:** M20. The rendered [module wireframe](../../wr/receivables/index.html) is a prototype with synthetic data, not a runtime feature.

## Screens and paired wireframes

| Screen ID | File | Job | Required variants |
| --- | --- | --- | --- |
| F20-SCR01 | [Công nợ](../../wr/receivables/index.html) | Search dealer balances with current asOf time. | No debt|Terminated dealer|Forbidden |
| F20-SCR02 | [Công nợ đại lý](../../wr/receivables/agency.html) | Display separate debt, credit, reservation and headroom. | Simultaneous debt and credit|Unavailable|Stale |
| F20-SCR03 | [Công nợ phiếu xuất](../../wr/receivables/invoice.html) | Compare original remainder with current outstanding and settlement sources. | SETTLED by return|SETTLED by credit|Partial |
| F20-SCR04 | [Sổ công nợ](../../wr/receivables/statement.html) | Review opening, dated changes, closing and effective history. | No movements|Backdated replay|Correction |
| F20-SCR05 | [Phân bổ thanh toán](../../wr/receivables/allocations.html) | Inspect source receipt/credit and target issue with current/reversed legs. | Reversed|Auto upfront|No edit |

## API ownership and integration

| operationId | Method and source path | Source permissions | Request preconditions | Backend First/Full | UI role | Wireframe |
| --- | --- | --- | --- | --- | --- | --- |
| `listReceivables` | GET `/receivables` | debt.read | — | M20/M20 | Owner | [Công nợ](../../wr/receivables/index.html) |
| `getAgencyBalance` | GET `/agencies/{agencyId}/balance` | (debt.read | credit.apply | cash.refund.post) | — | M20/M20 | Owner | [Công nợ đại lý](../../wr/receivables/agency.html) |
| `listAgencyInvoiceBalances` | GET `/agencies/{agencyId}/invoice-balances` | debt.read | — | M20/M20 | Owner | [Công nợ phiếu xuất](../../wr/receivables/invoice.html) |
| `getInvoiceBalance` | GET `/stock-issues/{documentId}/balance` | debt.read | — | M20/M20 | Owner | [Công nợ phiếu xuất](../../wr/receivables/invoice.html) |
| `listAgencyReceivableEntries` | GET `/agencies/{agencyId}/receivable-entries` | debt.read | — | M20/M20 | Owner | [Sổ công nợ](../../wr/receivables/statement.html) |
| `listDocumentAllocations` | GET `/documents/{documentId}/allocations` | debt.read | — | M20/M20 | Owner | [Phân bổ thanh toán](../../wr/receivables/allocations.html) |

Full operation support and persisted-kind/deployment coverage, not First delivery alone, control live availability. Screen links may be authored before the backend publishes a route.

## Implementation packets

1. **P0 — Pair planning and wireframes:** review screens, source schema/policy/state, linked HTML, synthetic fixture and accessibility notes. Keep this planning gate separate from runtime evidence.
2. **P1 — Feature boundaries:** implement route/adapter/model, focused forms and read states; record actual symbols and their cases in TESTS.
3. **P2 — Safe actions:** add exact payloads, permission and state guards, parent ETags/intent keys when specified, duplicate-submit prevention, error recovery and authoritative reload.
4. **P3 — Verified integration:** run contract-mocked tests, then published-operation real HTTP/browser flows, accessibility and responsive checks. Re-run owning/reader regression when later workflows publish.
5. **P4 — Full closure:** all owned and consumed required operations/states, later integrations and evidence pass; update the general checklist without treating a mock or HTML click as backend success.

## Domain edge and deferred gates

The agency balance resource belongs to F20 and is reused—not duplicated—by F24. Source-gap register: [D01–D17](../../../backend-design/plan/full_backend/DECISIONS.md). Backend R3/R4 are internal engineering milestones; full operational workflow handoff is R5. Use the [backend execution handoffs](../../../backend-design/plan/full_backend/EXECUTION.md). No new API path, business value or permission is implied by this plan.
