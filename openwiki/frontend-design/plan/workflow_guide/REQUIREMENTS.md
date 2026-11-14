# Workflow guide — requirements

Source: `tmp/HANDOFF-huong-dan-ngon-ngu-portal.md` §3 (2026-11-14). Frontend only; the
server stays the authority for every transition.

| ID  | Requirement                                                                                                                                                | Evidence (test)                                            |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| R1  | Every routed workspace page shows a **Hướng dẫn** button (`BookOpen`) in its header                                                                        | ShellLayout tools; `guide_components` "route guides"       |
| R2  | The guide opens a side sheet with purpose, roles, flow, steps, rules, common errors and related links                                                      | `guide_components` "opens the route guide…"                |
| R3  | Every route in `routePermissions` plus `/`, `/profile`, `/chatbot`, `/document-history` has a guide                                                        | `guide_components` "has a complete guide for every route"  |
| R4  | Workflow rails show written state (never colour only), role and a tooltip hint per step                                                                    | `guide_components` WorkflowSteps                           |
| R5  | Stock issue: Nháp → Nộp → Xác nhận trả ngay (only when `immediatePayment > 0`) → Ghi sổ, from real server data                                             | `guide_workflows` stockIssueWorkflow; `guide_pages`        |
| R6  | Ghi sổ is disabled with a reason while the upfront money is unverified; deep link `/upfront-payments?issue=<id>&new=1`                                     | `guide_pages` "blocks posting…"                            |
| R7  | Replacing a pending issue that has a VERIFIED confirmation is refused and explained; otherwise replacing warns that a new confirmation is needed            | `guide_pages` replace tests                                |
| R8  | `/upfront-payments?issue=<id>&new=1` opens the form with the issue preselected and cleans the URL; ignored without verify rights or with a malformed id     | `guide_pages` deep link                                    |
| R9  | Confirm dialogs list the consequences (stock ±, debt, auto receipt, purchase price, FIFO)                                                                  | `guide_workflows` issuePostEffects / goodsPostEffects      |
| R10 | After a successful action a bottom-right toast (≈6 s) says what happened and what is next, with **Mở** only when the user may open the target              | `guide_components` toasts                                  |
| R11 | The toast can be switched off on `/profile` ("Hiện gợi ý bước tiếp theo"); a storage failure keeps it on                                                   | `profile_guide`; `guide_components` preferences            |
| R12 | Every code in handoff §3.3 (61) and the re-scan (8 more) has `{message, hint}`; some have an `action` link                                                 | `i18n_core` error catalogue                                |
| R13 | Without the permission for the next step, the callout names the role that must act instead of a link                                                       | `guide_components`; `guide_pages` warehouse test           |

Non-goals: a backend preview of posting effects; the optional "Việc chờ bạn xử lý" list
(list endpoints expose no total counts).
