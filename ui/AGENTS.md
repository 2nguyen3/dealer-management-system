# Frontend project context

## Business simplification checkpoint - 2026-11-14

Features in `src/features/`: authentication, home, portal, guide, profile, dashboard,
reports, agencies, products, agency_types, units, wards, business_rules, master_data,
stock_receipts, stock_issues, payment_receipts, online_payments, document_history,
users, user_groups, permissions, audit_logs, chatbot (placeholder, not built). The menu
has 18 entries (`src/app/navigation.ts`) gated by the 22 backend function codes.
Removed (Bỏ theo yêu cầu 14/11/2026): receivables, stock_counts, upfront_payments,
inventory, agency_credit, refunds, sales_returns, stock_adjustments,
credit_applications, document_corrections. Portal decks saved in localStorage drop
removed routes; `src/lib/errors.ts` covers the new rule codes (PERIOD_CLOSED,
REASON_REQUIRED, AGENCY_HAS_DEBT, PAYMENT_EXCEEDS_DEBT, DEBT_LIMIT_EXCEEDED,
INSUFFICIENT_STOCK, PRODUCT_NOT_PRICED, WARD_CAPACITY_EXCEEDED…). Switching the
interface language reloads behind the `index.html` boot splash (`showLoadingSplash`
in `src/lib/i18n/runtime.ts`) instead of a blank page. Contract:
`../openwiki/backend-design/API/openapi.json` (90 operations). Evidence:
`../openwiki/backend-design/plan/simplification/VERIFICATION.md`. The starter-page
description below is historical.

This guide applies to work inside `ui/`. It describes the current frontend, its
place in the full application, and conventions for extending it. Commands run
from `ui/` unless stated otherwise.

## Project purpose and current state

**Agentra** is the app name. DMS means **Dealer Management System**, for managing the
distribution of goods to dealers. It is an Introduction to Software Engineering
course project at the University of Information Technology, Vietnam National
University Ho Chi Minh City. The root `README.md` contains team and course details.

The intended business scope includes dealer information, incoming and outgoing
goods, inventory, payments, outstanding dealer debt, and business reports.

The repository currently contains an infrastructure scaffold. The frontend shows
a development starter page with API connection status and a link to API docs.
The backend provides health endpoints, database configuration, session management,
migration tooling, reviewed DMS schema/demo seed, authentication and reusable RBAC.
Business screens, business HTTP endpoints and frontend authentication are future work.

## Technology stack

| Area             | Technology and role                                                                                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Runtime/tooling  | Node.js 24 LTS recommended and used in Docker; `package.json` requires Node.js `>=22.12.0`.                                                                              |
| Dependencies     | npm with `package-lock.json` for reproducible installs.                                                                                                                  |
| UI               | React 19 and React DOM 19; function components and built-in hooks.                                                                                                       |
| Language         | TypeScript 5.9 with strict checking; ECMAScript modules.                                                                                                                 |
| Build/dev server | Vite 7 with `@vitejs/plugin-react` 5.                                                                                                                                    |
| Styling/UI       | Tailwind CSS v4 + shadcn/ui (Radix) in `src/components/shadcn/`; lucide icons; palette + light/dark tokens in `src/styles.css`; Be Vietnam Pro; `next-themes`; `motion`. |
| Charts           | Recharts 3 via shadcn `chart`; palette/formatters in `src/lib/chart.ts`.                                                                                                 |
| Routing/tests    | React Router; Vitest + Testing Library (no jest-dom matchers).                                                                                                           |
| HTTP             | Browser `fetch`, `AbortController`, and `AbortSignal`; no API client library is installed.                                                                               |
| Quality          | ESLint 9, typescript-eslint, React Hooks/Refresh rules, and Prettier 3.                                                                                                  |
| Backend          | Python 3.12, FastAPI, Pydantic Settings, synchronous SQLAlchemy 2, psycopg 3, and Alembic.                                                                               |
| Database         | Neon PostgreSQL (Singapore), accessed only by the backend.                                                                                                               |
| Deployment       | Docker Compose and unprivileged Nginx 1.28 serving static assets.                                                                                                        |

There is no global state library or end-to-end test framework configured. Exact
dependency resolutions are recorded in the lockfiles.

## Repository structure

```text
DMS/
├── README.md                    # Project overview and full-stack setup
├── compose.yaml                 # Backend, frontend, and migration services
├── .gitignore
├── backend/
│   ├── AGENTS.md                # Backend context and development conventions
│   ├── README.md                # Backend setup and Supabase connection details
│   ├── pyproject.toml           # Python dependencies and quality tools
│   ├── uv.lock                  # Python dependency lockfile
│   ├── .env.example             # Backend settings template
│   ├── Dockerfile              # FastAPI container
│   ├── alembic.ini             # Migration configuration
│   ├── alembic/                # Migration environment and revision directory
│   ├── app/
│   │   ├── main.py             # Application factory, lifespan, and CORS
│   │   ├── api/router.py       # Health routes mounted under /api/v1
│   │   ├── core/config.py      # Validated environment settings
│   │   └── db/                 # SQLAlchemy Base, engine, and sessions
│   └── tests/test_health.py    # Backend health endpoint checks
└── ui/
    ├── AGENTS.md               # This context and working guide
    ├── README.md               # Frontend setup and command reference
    ├── package.json            # Dependencies, Node requirement, and npm scripts
    ├── package-lock.json       # Reproducible dependency resolution
    ├── .env.example            # Public API base URL template
    ├── .dockerignore           # Docker build exclusions
    ├── Dockerfile              # Node build stage and Nginx runtime stage
    ├── nginx.conf              # Static hosting, SPA fallback, and API proxy
    ├── index.html              # HTML document and React mount element
    ├── vite.config.ts          # React plugin, dev port, and API proxy
    ├── tsconfig.json           # TypeScript project references
    ├── tsconfig.app.json       # Browser application TypeScript settings
    ├── tsconfig.node.json      # Vite configuration TypeScript settings
    ├── eslint.config.js        # Flat ESLint configuration
    ├── .prettierrc.json        # Code formatting rules
    ├── .prettierignore         # Generated/dependency formatting exclusions
    └── src/
        ├── main.tsx            # createRoot, StrictMode, and global CSS import
        ├── styles.css          # Global layout, typography, status, and link styles
        ├── app/
        │   └── App.tsx         # Starter page and API status lifecycle
        └── lib/
            └── api.ts          # API base URL and health-check fetch helper
```

The backend tree is abbreviated; see `../backend/AGENTS.md` for its full guide.
Generated directories such as `node_modules/`, `dist/`, Python environments,
and tool caches are omitted.

## Application flow and current behavior

1. `index.html` provides the `#root` element and loads `src/main.tsx`.
2. `main.tsx` imports global CSS and renders `App` inside React `StrictMode`.
3. `App.tsx` starts with the status `checking` and runs a health request in an effect.
4. The effect combines an `AbortController` signal with a ten-second timeout using
   `AbortSignal.any()` and `AbortSignal.timeout()`.
5. `checkApiHealth(signal)` in `src/lib/api.ts` fetches the API's `/health` endpoint
   with an `Accept: application/json` header. It rejects non-success HTTP responses
   and validates that the JSON is an object with `status: 'ok'`.
6. The UI changes to `online` or `offline`. Effect cleanup aborts the request,
   and completion handlers avoid state updates after cleanup.

The page uses a typed status union and a `Record` of status labels. It displays
a header, introduction, connection status, docs link, and stack summary footer.
The status uses `role="status"`; its decorative dot is hidden from assistive
technology. The main section has a heading connected through `aria-labelledby`.

The health request runs on mount; there is no polling or retry interface. An
online result means the API process is available, not that PostgreSQL is ready.
React StrictMode can rerun effects during development, so preserve request cleanup.

## API integration and environment

`src/lib/api.ts` reads `import.meta.env.VITE_API_BASE_URL`, falls back to
`/api/v1`, and removes a trailing slash before appending endpoint paths.

| Endpoint                   | Purpose                                                                                                    |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/health`       | API liveness; returns `200` with `{"status":"ok"}` without querying the database.                          |
| `GET /api/v1/health/ready` | Database readiness; executes `SELECT 1`, returning `200` or a generic `503` database-unavailable response. |
| `/api/docs`                | Swagger UI; linked from the starter page.                                                                  |
| `/api/redoc`               | ReDoc documentation.                                                                                       |
| `/api/openapi.json`        | API schema.                                                                                                |

### Local development

Vite listens on port `5173` with `strictPort: true`; it fails if that port is
occupied. Its `/api` proxy forwards requests to `http://127.0.0.1:8000`, keeping
the default browser requests same-origin.

A frontend `.env` is optional for the default setup. To use another API URL,
copy `.env.example` to `.env` and set `VITE_API_BASE_URL`, including the API version
prefix when appropriate. An external API origin requires the frontend origin in
the backend's `CORS_ORIGINS` setting.

Vite environment variables are public and embedded at build time. Keep database
credentials and Supabase service-role keys on the backend. The frontend does not
connect directly to Supabase. Changing a deployed API base URL requires rebuilding
the frontend assets; setting a runtime Nginx environment variable is insufficient.

The docs link is hard-coded to same-origin `/api/docs`; overriding the API base
URL does not change that link. Account for this when using a separate API host.

## Styling and accessibility

Screens use shadcn/ui primitives and Tailwind utilities. App-level wrappers in
`src/components/ui/` (Button, Badge, Alert, Modal, Input, Select, Table,
Pagination, EntityPicker, StatusBadge…) keep stable APIs/test markers; page-level
blocks live in `src/components/blocks/` (PageHeader, KpiCard with delta+sparkline,
ChartCard with chart⇄table toggle, DateField showing dd/MM/yyyy while keeping ISO
business dates). The shell is the shadcn Sidebar (`src/app/ShellLayout.tsx`).

Theme: six colour palettes (Thủy default, Mộc, Kim, Hỏa, Thổ, Tím) selected through
`<html data-palette>` (`src/components/theme/palette.ts`, key `agentra-palette`, pre-paint
script in `index.html`), each with light and dark tokens; light/dark comes from
`ThemeProvider` (next-themes, class strategy, key `agentra-theme`). The header
`ModeToggle` and the `/profile` appearance tab switch both. Type is Be Vietnam Pro;
the brand stays the original `/assets/brand/agentra-*.png` logo (`BrandLogo` swaps the
dark/white wordmark via `.dark`; figures get `?theme=&shadow=` tokens from `figureTheme.ts`).
Icons are central: `Button`/`Modal` infer a lucide icon from the Vietnamese label/title
(`components/ui/actionIcons.ts`, `action`/`icon={false}` to override), `PageHeader` shows
the route's sidebar icon (`PageIconContext`), and status badges/filters use `statusIcons.ts`. Motion helpers
(`PageTransition`, `Stagger`, `CountUp`) live in `src/components/motion/`; Mebius-style
chart wrappers (rounded bars, gradient areas, donut, radial rings, segmented meter) in
`src/components/charts/MebiusCharts.tsx`.
Lists sort server-side through `SortableHeader`/`SortMenu` + `useSort`
(`src/components/data/`) using only the contract `sort` enum of each endpoint.
`/profile` shows identity, permission coverage, theme, interface language and hint preferences.

Interface text is translated (24 languages, Vietnamese source/default): wrap strings in
`t()`/`msg()` from `src/lib/i18n/core.ts`, never translate business data, keep VND, and
use logical CSS utilities for RTL. See `README.md` → Interface languages. Every page has a
GUIDE button (`src/features/guide/`) whose content must cover each route.

Charts follow the validated categorical palette `--chart-1..8` in fixed entity
order (never cycled or rank-coloured), single-hue magnitude, no dual axes, a legend
for two or more series, tooltips and a table view. Legacy global CSS still in
`src/styles.css` is unlayered and overrides Tailwind utilities; prefer removing it
over adding new global selectors.

Preserve semantic HTML, heading relationships, readable status text, effect cleanup,
and keyboard focus visibility when extending the interface. Keep new layouts usable
at narrow viewport widths and communicate status through text as well as color.

## Development and verification commands

From `ui/`:

```sh
npm ci
npm run dev
```

Open `http://localhost:5173`. Start the backend in another terminal from `backend/`
after configuring its `.env`:

```sh
uv sync --frozen
uv run uvicorn app.main:create_app --factory --reload
```

Frontend commands:

| Command                | Purpose                                                     |
| ---------------------- | ----------------------------------------------------------- |
| `npm run typecheck`    | Run `tsc -b` across the TypeScript project references.      |
| `npm run lint`         | Run ESLint with zero warnings allowed.                      |
| `npm run format:check` | Check Prettier formatting.                                  |
| `npm run format`       | Apply Prettier formatting.                                  |
| `npm run build`        | Run TypeScript checks and build static assets into `dist/`. |
| `npm run preview`      | Serve the production build locally after building.          |

`preview` is not a production server and does not provide the documented development
API proxy. Use Docker Compose for a full-stack production-build smoke test.
There is no `npm test` script. For frontend behavior changes, run the relevant
checks above and verify affected interactions in a browser, including loading and
API failure states when applicable.

### TypeScript and code style

- Browser code targets ES2022 with DOM types, bundler module resolution, and the
  automatic React JSX transform. Vite configuration targets ES2023 with Node types.
- Strict checking includes unused locals/parameters; browser code also enables
  `noUncheckedIndexedAccess` and prevents switch fallthrough.
- `verbatimModuleSyntax` is enabled; use type-only imports for type-only dependencies.
- ESLint applies recommended JavaScript, TypeScript, React Hooks, and Vite React
  Refresh rules to TypeScript files.
- Prettier uses no semicolons, single quotes, and trailing commas. Its check excludes
  `node_modules/`, `dist/`, and `package-lock.json`.

## Docker deployment

From the repository root, with `backend/.env` configured:

```sh
docker compose build
docker compose --profile tools run --rm migrate
docker compose up -d --wait --wait-timeout 120
docker compose ps
```

The frontend Dockerfile installs locked dependencies with `npm ci`, builds using
Node.js 24 Alpine, and copies `dist/` into an unprivileged Nginx container.
`VITE_API_BASE_URL` is a Docker build argument defaulting to `/api/v1`. Compose
reads its override from the shell or root `.env`; `ui/.env` is for local Vite.

Nginx behavior in `nginx.conf`:

- Listens on container port `8080` and serves static assets.
- Proxies `/api/` to `backend:8000`, preserving the request URI and forwarding headers.
- Uses Docker DNS to re-resolve the backend after container replacement.
- Caches `/assets/` for one year and returns `404` for missing assets.
- Falls back to `index.html` for application paths and sends `Cache-Control: no-cache`
  for the main location. SPA fallback is available even though no client router exists yet.
- Serves `/healthz` for the frontend container health check; it checks Nginx availability,
  not API or database readiness.

Compose additionally checks its writable cache mount, compiled index and proxied
API/database readiness, so container health reflects the full serving path. Root
`data/frontend/` binds to `/var/cache/nginx`; server-level client/proxy temp paths
write there. The root `data/` tree is Git-ignored. Compiled assets are image-owned.

Compose publishes the frontend as `${WEB_PORT:-8080}:8080` and waits for the backend
container's database readiness check to pass before starting the frontend. Valid
database credentials are therefore required for Compose startup. The default
application URL is `http://localhost:8080`.
The backend is also published on `127.0.0.1:8000` for direct local access, including
docs at `http://localhost:8000/api/docs`. Supabase remains an external managed database.
`API_PORT` overrides the backend's published port. Compose uses an `app` bridge
network, 30-second normal/five-second startup health intervals, and rotated logs (10 MB,
three files per service). Nginx gets a 15-second graceful shutdown period.
Unhealthy status alone does not trigger a container restart.

## Conventions for extending the frontend

### General Plan and strict integration gates

Read `../openwiki/frontend-design/GENERAL_PLAN.md` before planning or implementing
frontend features. It defines the module order, frontend dependencies, backend
slice readiness, common API/UX contract and strict testing/completion rules.
The next implementation module is `frontend_foundations`. F01–F32 now have paired
six-file plans in `../openwiki/frontend-design/plan/<module_name>/` and clickable
static HTML wireframes under `../openwiki/frontend-design/wr/<module_name>/`.
The [full frontend package](../openwiki/frontend-design/plan/full_frontend/PLAN.md)
indexes their operations, decisions and validation. They are not implemented UI.

Track slices, actual backend readiness and release gates in
`../openwiki/frontend-design/GENERAL_CHECKLIST.md`. Keep it aligned with the
General Plan and owning child evidence; mocked slices do not close live gates.

- Use `../openwiki/backend-design/API/openapi.json` as the single target HTTP
  contract and the backend General Plan for operation readiness. A plan or mock
  does not mean that a business endpoint is implemented.
- The backend `plan/full_backend/OPERATIONS.md` lists first/internal and full
  operation gates; use full published scope for live UI readiness. Its gap register
  tracks dashboard admission and chatbot candidate-paging decisions before F31/F32.
  Its EXECUTION release map also tracks D16 derived-price responses and D17 support
  for persisted later transaction kinds; R3/R4 alone do not close the full live
  document workbench's line/cancellation/integration gates.
- Before child-module code, define PLAN/REQUIREMENTS/DESIGN/TESTS/CHECKLIST/
  VERIFICATION materials with screen/action-to-operation/permission mapping.
- Register/test every completed actual function, component, hook, adapter,
  validator and callback with success/failure/boundary assertions; declare scoped
  coverage gates and record exact commands/results before closing items.
- Add the frontend test/browser harness in the foundations module; none exists
  today. Required skipped/xfailed/unrun tests keep completion gates open.
- Keep contract-mocked and live-integrated slices distinct. Full completion
  requires relevant backend gates, real-browser critical-flow tests, keyboard/
  responsive behavior and all deferred workflow integrations.
- Preserve exact IDs/numeric strings/business dates, parent ETags and stable
  intent keys; treat the server as stock/debt/payment/permission authority.
- Keep roadmap progress/dependencies and owning plans/evidence aligned. Do not
  duplicate the backend API spec or turn provider redirects into payment success.

### General extension conventions

- Keep application composition in `src/app/` and shared infrastructure such as API
  communication in `src/lib/`.
- Follow `ui/README.md`: group future features under `src/features/<feature>/`,
  colocating components, hooks, and types. This directory does not exist yet.
  Promote feature code to shared modules when it is reused.
- Follow existing function-component, typed-state, and relative-import patterns.
  Keep asynchronous request cancellation and explicit loading/error states.
- Validate external API data rather than assuming a TypeScript type makes incoming
  JSON safe. Keep API paths consistent with the backend's `/api/v1` contract.
- Keep styles consistent with the existing CSS approach and account for global
  selector effects when adding screens.
- Update `package-lock.json` when dependencies change. Update `.env.example` and
  setup documentation when introducing public configuration.
- Keep this guide aligned with implemented features and folder changes. Supporting
  references are `README.md`, `../README.md`, and `../backend/AGENTS.md`.
