# Full frontend — Decisions

**Prepared:** 2026-10-03. **Status:** planning + static wireframes; no business frontend implementation. The [General Plan](../../GENERAL_PLAN.md) controls dependencies and [General Checklist](../../GENERAL_CHECKLIST.md) tracks evidence.

## Frontend decisions and source blockers

| ID | Decision/status | Owning gate |
| --- | --- | --- |
| FE-D01 | **Selected by user:** clickable mid-fidelity HTML, multiple pages, coherent Vietnamese internal-app copy; no live API writes. | All paired screens. |
| FE-D02 | **Selected by user:** refresh survives same-tab reload; browser-restored storage may persist longer; copied/new tabs do not share a rotating session. | F02/browser one-winner test. |
| FE-D03 | **Proposed implementation:** React Router + TanStack Query + native fetch + OpenAPI-derived types/Ajv + Vitest/MSW/Playwright, plain CSS; lock/install/test in F01. | F01. |
| FE-D04 | **Blocked by backend D09:** dashboard route admission vs section readers. Do not silently change grants. | F31/M31 source update. |
| FE-D05 | **Blocked by backend D10:** chatbot 26+ candidates lack permission-safe continuation. Do not call broader agency API on behalf of chatbot-only reader. | F32/M32 source update. |
| FE-D06 | **Blocked by backend D16:** derived selling quote may exceed Money or round to zero; show quote/unusable-sale distinction after source policy. | F11/F12/F16/F31/F32 and M10/M11. |
| FE-D07 | **Deployment/backend D17:** seeded later kinds require replay support before earlier money writers publish; First/Full alone insufficient. | F14–F29/backend R5. |
| FE-D08 | **Contract review:** preparer-only permissions may lack necessary agency/product lookup; specify minimal authorized lookup or documented prerequisite grants. Do not invent access. | F14/F17/F18/F23/F27. |
| FE-D09 | **Contract review:** online refund retry describes reason but requestOnlineRefund currently has no requestBody; reason must not be submitted without a source change. | F27/M27. |
| FE-D10 | **Environment:** select accepted sandbox and mail/reset public URL; local fixture/demo isn't deployed provider evidence. | F02/F26/F27. |

Cross-reference the complete [backend D01–D17 register](../../../backend-design/plan/full_backend/DECISIONS.md). Proposed engineering resolution is not an implemented source contract.
