# VERIFICATION — Phường/xã TP.HCM 2025

## W1 — Backend + DB (migration 0010) — 2026-11-13

Scope: [GOAL](GOAL.md) W1 decisions D1–D4. Production (Neon `dms`) was **not** touched;
D5 backup/upgrade/live verify remains for the operator.

### Migration design (revision `0010`)

Files: `backend/alembic/sql/0010_hcmc_wards.sql`, `backend/alembic/versions/0010_hcmc_wards.py`.

1. `CREATE TABLE dms.ward (id identity PK, code text UNIQUE CHECK '^[0-9]{5}$', name text
   UNIQUE, kind text CHECK IN (WARD, COMMUNE, SPECIAL_ZONE), createdAt, updatedAt)` with the
   standard `z_stamp` trigger; no status, no audit trigger, no runtime writer. 168 rows
   generated from [hcmc_wards_2025.json](../../../database-design/hcmc_wards_2025.json)
   (cited in the SQL header) in GSO-code order, then asserted 168 = 113/54/1. Ids follow
   code order (e.g. `26732` Đặc khu Côn Đảo = 66, `26740` Phường Sài Gòn = 68).
2. Temporary `legacy_district_ward` (20 reviewed rows of `legacyDistrictToWard`). Any
   `district.name` without a mapping raises `No reviewed ward mapping for district(s) …`
   and rolls the whole revision back. `agency."wardId"` FK → ward (`agency_wardId_fkey`),
   backfilled, `SET NOT NULL`, `districtId` dropped, `ix_agency_ward_active` (partial) and
   `ix_agency_ward` created.
3. Address rewrite only where `, <old district>, TP.HCM` occurs (agency's own district),
   replaced by `, <ward name>, TP.HCM`. `audit_change` needs no actor (NULL → `SYSTEM`);
   the migration sets `dms.request_id = alembic-0010-hcmc-wards`, so every changed agency
   (and the deleted grants) is audited, as with any other change. `updatedAt` is bumped.
4. `business_rule."maxAgenciesPerDistrict"` → `"maxAgenciesPerWard"` (check constraint
   renamed too). `guard_agency()` / `guard_rules()` replaced: same `business_rule FOR
   UPDATE` serialization, no inactive check, messages `Ward agency capacity exceeded` /
   `New ward limit is below existing active count`.
5. `agency_overview` dropped/recreated with `"wardName"` (no other view/function depends
   on it; `sales_report`/`debt_report` only use `agency`).
6. `district.manage`: all `group_permission` rows deleted. `audit_log."functionCode"`
   references `app_function(code) ON DELETE RESTRICT`, so the `app_function` row is
   deleted **only when no audit row references it**. A seeded/production DB has historical
   audit rows (21 in the demo), so the row stays there; the API hides it (function list,
   grant writes → 404) and audit reads accept it as a retired code. `DROP TABLE district`.
7. Downgrade: re-adds `district.manage` (if deleted) and its 0001 default grants
   (MANAGEMENT only), recreates `district` from the 0001 DDL with z_stamp/audit triggers and
   the 20 mapped names as `DISTRICT_01..20`, restores `districtId`/addresses/indexes, rule
   column, the 0001 `guard_agency`/`guard_rules`/`agency_overview` text (extracted from the
   immutable 0001 snapshot), drops `ward`. Lossy: district ids/timestamps regenerated, all
   restored districts ACTIVE (the demo had `DISTRICT_20` INACTIVE), custom grants reset,
   `districtId` becomes the last agency column. Agencies in a ward outside the mapping
   block the downgrade (`Agencies use ward(s) without a former district`).

### API contract as implemented (vs GOAL)

- `GET /api/v1/wards` `listWards`, params `limit, cursor, q, code, kind, sort`
  (sort = id/code/name ±, limit ≤ 100 as other catalogues); `GET /api/v1/wards/{wardId}`
  `getWard` with ETag; x-permissions `anyOf [agency.read, agency.manage]`; no
  POST/PATCH/DELETE (405).
- **Additive deviation:** items also carry `activeAgencyCount`, `maxAgencies`,
  `remainingSlots` (same capacity projection as former districts). No `status`.
- Agency `wardId`/`wardName`; filter `wardId` on agencies, receivables, `/reports/debt`;
  receivable item `wardId`; business rule `maxAgenciesPerWard`; error
  `WARD_CAPACITY_EXCEEDED` with details `{wardId, activeAgencyCount, maxAgencies}`;
  rule lowering keeps code `LIMIT_CONFLICT` with details `blockedWards: [{wardId, code,
  name, activeAgencyCount}]`. Report export filter label `Phường/xã (ID)`.
- Dashboard has no district filter/dimension in the backend; nothing renamed there.
- `district.manage` removed from `FunctionCode`; audit `functionCode` uses new
  `AuditFunctionCode` (= FunctionCode + retired `district.manage`). Audit
  CATALOGUES/CATALOG_KEYS accept historical `district`/`districtId` and new `ward`/`wardId`.
- `openapi.json`: Districts tag/paths/schemas/request bodies/responses/examples replaced by
  Wards (`Ward`, `WardKind`, `WardListResponse`, `WardFilter`, `WardId`, `WardKindFilter`),
  `AuditFunctionCode` added, all district fields/labels renamed. Canonical operations
  154 → 151 (runtime business operations 153 → 150; only `queryChatbot` unpublished).

### Commands and results

Offline (from `backend/`):

| Command | Result |
| --- | --- |
| `uv run ruff check .` | All checks passed |
| `uv run ruff format --check .` | 558 files already formatted |
| `uv run pytest` | 1192 passed, 631 deselected (first run: 6 contract failures from the stale source contract/operation counts, fixed by the openapi update and 153→150 / 154→151 count updates) |

Throwaway PostgreSQL only: `docker run -d --rm --name dms-wards-pg -e POSTGRES_PASSWORD=…
-p 127.0.0.1:55432:5432 postgres:18` (PostgreSQL 18.6). Alembic/seed/verify pointed at it
with process env `DB_HOST=127.0.0.1 DB_PORT=55432 DB_NAME=<db> DB_USER=postgres
DB_PASSWORD=… DB_SSLMODE=disable` (env overrides `.env`; host confirmed before running).

| Scenario | Result |
| --- | --- |
| (a) fresh `alembic upgrade 0009` → old-code `app.db.seed` → `verify --seeded --regression` | 30 agencies/410 documents/3,740 audit; PASS 30 tables; PASS 54 regression |
| (a) `upgrade 0010` | 168 wards; 30 agencies in 10 distinct wards; addresses `…, Phường Sài Gòn, TP.HCM (mẫu)`; `district.manage` row kept (21 audit refs), 0 grants; +34 audit (30 agency, 4 grant) |
| (b) `downgrade 0009` | 20 districts, addresses back to `…, Quận 1, TP.HCM (mẫu)`, `districtName` view, 4 grants; `verify --seeded --regression` PASS/54; `pg_dump -s` vs pre-upgrade snapshot differs only in `agency."districtId"` column position |
| (b) `upgrade head` again | 0010; no address left containing a district name |
| unmapped district (`Quận 2` added at 0009) → `upgrade head` | fails `No reviewed ward mapping for district(s) Quận 2`; stays at 0009 |
| (a) new code on upgraded DB: `verify --seeded --regression`, `seed` rerun | PASS 30 tables (incl. ward 168); PASS 54 baseline 0001+0010 regression; seed: "already seeded; verified, no changes" |
| (c) fresh `upgrade head` (0010) → `seed` → `verify --seeded --regression` → `seed` | seed PASS (30 agencies, 410 documents, 32 functions, 128 grants, 3,723 audit, 168 wards); PASS 30 tables; PASS 54; rerun verifies without changes |
| fresh vs upgraded agency data | md5 of (id, name, address, ward code, status) identical |

PG integration suites against the container (`BUSINESS_TEST_DATABASE_URL=
postgresql+psycopg://postgres:…@127.0.0.1:55432/agentra_business_test?sslmode=disable`):

| Command | Result |
| --- | --- |
| `uv run pytest tests/integration/catalogues tests/integration/master_data tests/integration/business_rules -m integration` | 149 passed, 2 failed (`master_data/test_migration.py` seeded at old head 0005 with current seed code); fixed to seed at head then downgrade/re-upgrade, rerun 2 passed |
| `uv run pytest tests/integration/master_data/test_migration.py tests/integration/shared_api tests/integration/permissions tests/integration/audit_logs tests/integration/auth/test_migrations.py tests/integration/workflows/test_isolation.py -m integration` (plus `AUTH_TEST_DATABASE_URL=…/agentra_auth_test`) | 46 passed, 3 failed: `shared_api/test_foundations` (seeded at old head 0003) and `permissions` (33→32 functions) fixed, rerun 7 passed; `workflows/test_isolation` fails on its pre-existing `pytest.raises(TypeError)` for bytes SQL (unrelated to wards) |

New tests: `tests/catalogues/test_wards.py` (10 offline: schema, repository/service,
retired code, list/detail/404/405/422, permission matrix, runtime-vs-source contract) and
`tests/integration/catalogues/test_wards.py` (6 PG: exact catalogue + constraints, HTTP
filters/cursor/search/sort/ETag/agency `wardId`, permission anyOf, ward move and rule
lowering capacity, populated 0009→0010→0009→0010 incl. retired-code API behaviour,
unmapped upgrade/downgrade failures). Removed: district create/update/delete/inactive
cases (catalogue CASES entry, district races/inactivation, inactive-district admission).
Updated the full-capacity test to wards. Stale pre-existing `"0007"` head assertions in
touched files now use `COMPATIBLE_HEAD`.

Regression: `app.db.verify --regression` now applies 0001 **and** 0010 to its isolated
schema; check count unchanged at 54 (district capacity checks now target wards).

### Incident

`tests/integration/workflows/test_isolation.py` opens `build_engine(Settings().database_url())`
on the **runtime DB from `backend/.env`** (no env override was active in that shell), so
this run made two read-only `SELECT version_num, count(document)` queries against the
configured production database (it asserts nothing changed). No write was issued. Do not
select that test unless runtime reads are acceptable.

### Not run

- Production backup/upgrade/live verify (D5, operator).
- Deployment smoke (`tests/deployment`, updated to pick a ward with free slots); Docker
  compose stack not rebuilt/restarted.
- `uv run pytest tests/integration` as a whole, i.e. other PG suites not listed above (workflows, documents, reports, dashboard,
  etc.); coverage gates not measured.
- Supabase/Neon `SUPABASE_TEST_SCHEMAS` mode.

Throwaway container `dms-wards-pg` was stopped/removed (`--rm`) after the runs.

## D5 — Production backup and upgrade (Neon `dms`) — 2026-11-13

- Backup: `pg_dump -Fc -n dms --no-owner --no-privileges` (postgres:18 client, direct host) →
  `D:\WorkSpace\projects\DMS_backups\dms_pre0010_20261113.dump` (604,597 bytes, outside the repo);
  `pg_restore -l` lists 30 `TABLE DATA` entries.
- Pre-state: head `0009`; 415 documents, 32 agencies, 24 products, 3,801 audit rows, 132 grants,
  33 functions; agencies only in mapped districts (Quận 1–12 ×3 each for ten, Thủ Đức ×2).
- `uv run alembic upgrade head` with `DB_HOST` overridden by the direct host: exit 0.
- Post-state: head `0010`; 168 wards; 415 documents, 32 agencies, 24 products unchanged; 11 wards in
  use (3 agencies each, Phường Thủ Đức 2); audit 3,837 (+36 SYSTEM rows: 32 agency ward/address
  updates + 4 retired grant deletions); grants 128; `district.manage` row retained for audit FK.
- `uv run python -m app.db.verify --seeded --regression`: PASS 30 tables/integrity; PASS 54
  regression assertions (0001+0010).
- Docker backend force-recreated: readiness 200; `GET /wards` 168 items with capacity fields,
  `q=Sài` → Phường Sài Gòn (3 active, rule 20); agencies return `wardId`/`wardName` and rewritten
  addresses; `GET /business-rules` returns `maxAgenciesPerWard`.
- Rollback: `pg_restore` the dump into `dms` (or `alembic downgrade 0009`, lossy as documented in W1).

## W3 — Frontend polish (built on W2) — 2026-11-13

### Changes

1. **Login/forgot/reset colours follow the theme.** `AuthLayout` intro panel uses tokens only
   (`from-primary/12 via-muted to-background`, primary glow, `border-r`); no hex. New
   `components/brand/BrandLogo` renders `agentra-dark.png` (light) and `agentra-white.png` (dark),
   CSS `.dark` picks one, so the logo is right on first paint. `ModeToggle` (light/dark/system +
   six palettes) is now on the auth pages. Title icon tiles: Đăng nhập `ShieldCheck`, Quên mật khẩu
   `KeyRound`, Đặt lại `LockKeyhole`; back/login links carry icons; `PasswordToggle` has a tooltip.
   Figure: `IllustratedFigure` passes `?theme=&shadow=` (`components/theme/figureTheme.ts`: palette
   swatch mixed toward slate) and is keyed by URL, so a theme/palette switch reloads it; the iframe
   gets `color-scheme: light` (removes Chromium's opaque white backdrop on dark pages) and
   `dark:brightness-[.86] saturate-[.9]`. `public/figures/{supplychain,forklift}.html`: one line
   each — `SHADOW` reads a validated `#rrggbb` `shadow` param, default `#41538f`. Unused
   `DistributionFigure.css` hex colours → tokens.
2. **Sidebar brand never squashed.** `ShellLayout` brand: fixed `size-8 shrink-0` tile with a
   28×28 `aspect-square max-w-none object-contain` image at the same 8px inset as the menu buttons;
   header `px-2`, no collapse-only padding/centering. Measured in Chrome through the collapse
   animation (t+0/30/80/150/600 ms): tile stays x=8, 32×32, image 28×28; collapsed rail 48px with
   the tile aligned to the 32px nav buttons (centred). Mobile sheet unaffected.
3. **More icons, less text (central first).** `components/ui/actionIcons.ts`: one `ACTION_ICONS`
   map + Vietnamese label inference (`inferAction`, Unicode word-boundary, specific phrases first,
   "xuất hàng" never = export). `Button` infers its icon from plain-text labels (`action` prop to
   force, `action={false}` to opt out); `Modal` infers a title icon. `PageHeader` shows the route's
   sidebar icon via `PageIconContext` provided by the shell (nested routes use the closest parent;
   `icon` prop / `false`). `StatusBadge` + `statusIcons.ts` (POSTED ✓, CANCELLED ban, DRAFT
   file-pen, PENDING clock, LOCKED lock…); `Badge` defaults tone icons (neutral keeps the dot,
   `icon={false}` for audit field-key chips). Segmented/toggle status filters show status icons
   (`FilterIcon`). `TableCard`/`SectionCard` accept a title icon (TableCard defaults to `List`);
   icons added to receivables, online payments, agency credit, upfront, inventory insights,
   correction dialog and goods-document form sections; report tabs and the permissions tab got
   icons. Trimmed: "Bấm tiêu đề cột để sắp xếp" (×3), reports header line (tabs say it), shorter
   online-payment table note and login subtitle. No API calls or business behaviour changed.

### Commands and results (from `ui/`)

- `npm run lint` — pass (0 warnings). `npm run typecheck` — pass.
- `npm test` — 52 files / 604 tests pass (new `src/test/w3_polish.test.tsx`; updated
  `auth_components`, `auth_redesign`, `blocks` for logo pair and themed figure URL).
- `npm run build` — pass. `prettier --check` on every touched file — pass (the two figure HTML
  files remain in the known pre-existing exception list).
- Browser (Chrome headless via playwright-core, Vite dev on :5199, API fully mocked with
  `page.route`, no backend reads/writes). Screenshots in the session scratchpad `w3/`:
  `before-*` vs `after-*` for login light/dark/Hỏa/Tím/Mộc/mobile-dark, shell
  expanded/collapsing/collapsed light+dark, brand crop, mobile sheet; plus
  `after-login-toggled-tho-dark.png` (on-page toggle: logo → white, figure URL
  `theme=dark&shadow=%23784f19`) and stock-receipts/reports/receivables light+dark.

### Not done / notes

- `DistributionFigure.tsx` (unused) keeps its own SVG illustration tones.
- Full-repo `prettier --check` still reports pre-existing CRLF files; `vitest.config.ts` has a
  duplicate `testTimeout` key warning (not touched here).

## Follow-up — agencies overview, picker dropdown, test timeouts — 2026-11-13

- Agencies overview tiles restored from ward capacity (`listAllWards`, ≤5 pages of 100): active
  agencies, wards with agencies, agency types, full wards. Ward decoder accepts non-negative integer
  `activeAgencyCount`/`maxAgencies`/`remainingSlots`.
- `EntityPicker` (product/agency/ward/… pickers): list rendered as an inline Radix Popover
  (fixed-position, collision-aware) so it escapes table/modal scroll clipping; width follows content
  (min input width/16rem, max 36rem/viewport), labels wrap, details stay on one line; chosen label
  exposed as `title`; label/required marker/height aligned with `Select`.
- Test infra: `asyncUtilTimeout` 3 s in `src/test/setup.ts` (parallel jsdom popover mounts exceeded
  1 s; affected files 120/120 alone); duplicate `testTimeout` key removed.
- `npm run lint` 0 warnings; `npm run typecheck` pass; `npx vitest run` 610/610 three consecutive
  runs; `npm run build` pass; touched files prettier-clean. Frontend container rebuilt, 8080/healthz/
  readiness 200. Real-browser check of the new dropdown against the live stack not performed.
