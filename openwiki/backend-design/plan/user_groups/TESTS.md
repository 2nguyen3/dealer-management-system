# M03 strict tests

Register actual callables as introduced; completion requires success/failure/boundary
cases and 100% statements/branches on `app.modules.user_groups`, plus retained
auth/shared regression gates. The [current combined commands](../../../../.agents/workflows/verify.md)
include all moved code and are recorded in [refactor evidence](../../../../backend/REFACTOR_VERIFICATION.md).

| Case | Behavior/layer |
| --- | --- |
| G01 | Strict nonblank create; nonempty PATCH, null/extra rejection, one-field updates; offline/HTTP. |
| G02 | List/search/code/six sorts, ties, literal percent/underscore, signed changed-filter rejection; PG/HTTP. |
| G03 | Create persists no grants, exact response/schema/Location/ETag; duplicate code/name rollback and case-sensitive distinct code; PG/HTTP. |
| G04 | Missing/stale/duplicate If-Match, joined userCount ETag change, one-winner competing update; PG/HTTP/concurrency. |
| G05 | Unreferenced grant-only deletion removes both, two audited rows, empty204; ACTIVE/LOCKED blockers leave grants unchanged; PG/HTTP. |
| G06 | Failure after tentative cleanup or during commit rolls back group/grants/audit; PG. |
| G07 | Actual independent assignment/deletion races, FK locks and stale-write outcome; PG/concurrency. |
| G08 | Read anyOf, delete allOf, no MANAGEMENT bypass, missing bearer and revoked grants/current auth parity; PG/HTTP. |
| G09 | Runtime/source operation IDs/statuses/security/body/schema/header inventory; frozen lint/format/default tests and scoped coverage. |

Planned tests: tests/user_groups and tests/integration/user_groups. Explicit PG
selection requires BUSINESS_TEST_DATABASE_URL and fails setup when missing.

## Actual callable register

All paths relative to backend/; unit request tests plus PG state/HTTP/races are
required together. No newly owned behavioral callable is omitted.

| Symbol | Requirements and tests |
| --- | --- |
| `modules.user_groups.schemas.GroupUpdate.nonempty_patch` | UG03/G01; `test_group_schemas.test_group_requests_strict_and_patch_omission`, invalid/null/empty/extra/type/one-field cases |
| `modules.user_groups.service.group_etag`, `to_group_response` | UG01/03; source DTO/headers, userCount changes/ACTIVE/LOCKED and stale-update race |
| `GroupService.__init__`, `query`, `get` | UG01/05; create/get/missing, exact safe SQL counts, source schemas and typed catalogue parameters |
| `GroupService.list` | UG05/G02; six independently specified sort oracles, keyset pages, trimmed literal search/code AND filters, changed-filter/tamper/missing anchor, 7000-character code/name boundaries |
| `GroupService.lock` | UG03/04/G04/07; missing/stale, real blocking in both FK orders and concurrent update one-winner |
| `GroupService.write` | UG06/G03/05/06; before-success typed materialization, known duplicate rollback, injected mid-cleanup/deletion-commit/create-commit failures restore group/grants/audit |
| `GroupService.create`, nested `work` | UG02/G03/08; no implicit grants, uniqueness/case-sensitive boundaries, current recheck and rollback |
| `GroupService.update`, nested `work` | UG03/G04/08; omitted fields, missing/stale/duplicate tags, duplicate rollback, actual committed grant revocation during target lock wait |
| `GroupService.delete`, nested `work` | UG04/G05/06/07/08; referenced ACTIVE/LOCKED retain grants; atomic audited eligible cleanup/empty204; both assignment lock orders; committed revocation during wait; cleanup and commit rollback |
| `modules.user_groups.router.responses` | UG01–07/G09; all five runtime operation/status/security/request/response/header/source schema comparisons |
| `modules.user_groups.dependencies.get_group_service`, nested `authorize` | UG06/07/G08; matched-operation actor/peer limits and fresh permissions; read anyOf/delete allOf/no MANAGEMENT bypass, denial after real lock wait |
| `modules.user_groups.router.list_groups`, `get_group`, `create_group`, `update_group`, `delete_group` | UG01–07/G01–09; real authenticated HTTP operations, safe validation/missing bearer/status/header and empty204; direct/Nginx smoke |
| `modules.user_groups.repository.GroupRepository.__init__`, `query`, `lock` | UG01/05/G02/04/07; existing create/get/list/missing/user-count tests and real lock-order/stale-write concurrency tests exercise delegation on the same caller session |
| `GroupRepository.create`, `update`, `delete` | UG02–04/06/G03–07; existing persisted success/uniqueness/rollback/cleanup/races plus `test_groups.test_repository_mutations_remain_in_caller_transaction` (3 cases): independent connection sees committed state only; caller rollback restores group/grants and leaves no audit or uncommitted creation |

Boundary regressions from review additionally assert retained grants on both
referenced-user statuses, exact pre-/post-failure audit counts, real committed
revocation after HTTP admission, and long unbounded TEXT values with bounded cursors.
