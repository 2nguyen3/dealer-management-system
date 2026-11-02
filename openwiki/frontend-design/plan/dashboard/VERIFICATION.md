# F31 — dashboard: Verification

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Current evidence boundary

This module's Markdown and linked static HTML were prepared by `python -B openwiki/frontend-design/build_frontend_design.py`. The program-wide [verification log](../full_frontend/VERIFICATION.md) records exact checks **actually run** after generation. Static HTML illustrations are not frontend component tests, real API responses or proof of money movement. No module-specific implementation, typecheck, test coverage, deployed backend integration or browser evidence is claimed here.

## Implementation evidence to record

| Phase | Actual symbols/revision | Source operations/Full backend gate | Exact command, workdir and result | Browser viewport/accessibility/fixture | Blockers |
| --- | --- | --- | --- | --- | --- |
| Planning | F31-SCR01–F31-SCR04, [module HTML](../../wr/dashboard/index.html) | M31/D09; business routes remain future until published | See full_frontend/VERIFICATION; no feature tests | Synthetic static wireframes; review pending | D09 admission/section-permission mismatch requires a source decision before final integration. |

On implementation, append concrete case IDs, nodes, statement/branch coverage per owned behavioral file, required skips/xfails, real API/browser evidence and backend release reference. Keep planning, mocked, live-integrated and full-module status separate.
