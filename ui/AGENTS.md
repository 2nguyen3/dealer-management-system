# Frontend project context

This guide applies to work inside `ui/`. It describes the current frontend, its
place in the full application, and conventions for extending it. Commands run
from `ui/` unless stated otherwise.

## Project purpose and current state

DMS means **Dealer Management System**: an application for managing the
distribution of goods to dealers. It is an Introduction to Software Engineering
course project at the University of Information Technology, Vietnam National
University Ho Chi Minh City. The root `README.md` contains team and course details.

The intended business scope includes dealer information, incoming and outgoing
goods, inventory, payments, outstanding dealer debt, and business reports.

The repository currently contains an infrastructure scaffold. The frontend shows
a development starter page with API connection status and a link to API docs.
The backend provides health endpoints, database configuration, session management,
and migration tooling. Business screens, domain API endpoints, application tables,
authentication, and authorization have not been implemented yet.

## Technology stack

| Area | Technology and role |
| --- | --- |
| Runtime/tooling | Node.js 24 LTS recommended and used in Docker; `package.json` requires Node.js `>=22.12.0`. |
| Dependencies | npm with `package-lock.json` for reproducible installs. |
| UI | React 19 and React DOM 19; function components and built-in hooks. |
| Language | TypeScript 5.9 with strict checking; ECMAScript modules. |
| Build/dev server | Vite 7 with `@vitejs/plugin-react` 5. |
| Styling | Plain global CSS in `src/styles.css`; no CSS framework or component library is installed. |
| HTTP | Browser `fetch`, `AbortController`, and `AbortSignal`; no API client library is installed. |
| Quality | ESLint 9, typescript-eslint, React Hooks/Refresh rules, and Prettier 3. |
| Backend | Python 3.12, FastAPI, Pydantic Settings, synchronous SQLAlchemy 2, psycopg 3, and Alembic. |
| Database | Supabase-hosted PostgreSQL, accessed by the backend. |
| Deployment | Docker Compose and unprivileged Nginx 1.28 serving static assets. |

There is currently no client-side router, global state library, frontend test
runner, or end-to-end test framework configured. Exact dependency resolutions
are recorded in the lockfiles.

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

| Endpoint | Purpose |
| --- | --- |
| `GET /api/v1/health` | API liveness; returns `200` with `{"status":"ok"}` without querying the database. |
| `GET /api/v1/health/ready` | Database readiness; executes `SELECT 1`, returning `200` or a generic `503` database-unavailable response. |
| `/api/docs` | Swagger UI; linked from the starter page. |
| `/api/redoc` | ReDoc documentation. |
| `/api/openapi.json` | API schema. |

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

The current UI uses plain CSS with a light background, dark text, muted secondary
text, and green/red connection indicators. The root font stack prefers Inter and
then system fonts; no font file or web-font import is currently provided.

The layout has a centered `1080px` maximum-width main area, a `320px` minimum body
width, fluid heading/section sizes using `clamp()`, and visible keyboard link focus.
Many selectors target HTML elements globally, so consider their effect on all
screens when adding styles.

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

| Command | Purpose |
| --- | --- |
| `npm run typecheck` | Run `tsc -b` across the TypeScript project references. |
| `npm run lint` | Run ESLint with zero warnings allowed. |
| `npm run format:check` | Check Prettier formatting. |
| `npm run format` | Apply Prettier formatting. |
| `npm run build` | Run TypeScript checks and build static assets into `dist/`. |
| `npm run preview` | Serve the production build locally after building. |

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

Compose publishes the frontend as `${WEB_PORT:-8080}:8080` and waits for the backend
container to be healthy. The default application URL is `http://localhost:8080`.
Only the frontend port is published; Supabase remains an external managed database.

## Conventions for extending the frontend

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
