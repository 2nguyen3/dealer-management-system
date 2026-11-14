# Agentra frontend

React 19 + Vite + strict TypeScript, Tailwind CSS v4, shadcn/ui components,
Recharts (via shadcn `chart`), React Router, Vitest,
ESLint, and Prettier. Use Node.js 24 LTS (minimum 22.12) and npm. Commit
`package-lock.json` when dependencies change.

## Local development

From `ui/`:

```sh
npm ci
npm run dev
```

Open http://localhost:5173. Run the backend on port 8000 in a second terminal.
Vite proxies `/api` to FastAPI so local requests use the same origin.

The application uses authenticated, permission-aware navigation. The home page
shows accessible business functions without preloading their data. Use
`/api/v1/health/ready` to verify backend database connectivity.

The default API base URL is `/api/v1`. To override it, copy `.env.example` to
`.env` and set `VITE_API_BASE_URL`. Vite variables are public and are embedded
at build time. Never put database credentials or service-role keys in them.
An external API origin also needs the frontend origin in backend `CORS_ORIGINS`.

## Structure

```text
src/
  app/          # Application composition
  components/
    shadcn/     # Generated shadcn/ui sources
    ui/         # Existing component API adapters and application widgets
    blocks/     # Page blocks: PageHeader, KpiCard, ChartCard, DateField
  features/     # Business and authentication screens
  lib/          # Shared infrastructure, including API calls
  main.tsx      # React entry point
  styles.css    # Tailwind import, theme tokens, and application styles
```

`components.json` configures the shadcn CLI; run `npx shadcn@latest add <name>`
from `ui/`. Generated files live in `src/components/shadcn/` rather than
`src/components/ui/` because Windows file names are case-insensitive and the
existing `Button.tsx`/`Input.tsx` adapters must not be overwritten. Keep shared
component APIs stable while migrating screens. Group feature code under
`src/features/<feature>/`.

## Commands

```sh
npm run lint
npm run typecheck
npm run format:check
npm run build
npm run test
npm run preview
```

`preview` serves a local production build; it is not a production server and
does not provide the development API proxy. Use Docker Compose for a full-stack
production-build smoke test. `npm run format` applies Prettier formatting.
`npm run test:e2e` runs the browser smoke test against a running app.
`npm run i18n:extract [-- out.json]` lists every interface message ID.

## Interface languages

Vietnamese is the source and default language; 23 more (English, Chinese ×2, Japanese,
Korean, Thai, Indonesian, Malay, Filipino, Khmer, Lao, Burmese, Hindi, Bengali, Urdu,
Arabic, Turkish, Russian, German, French, Spanish, Brazilian Portuguese, Italian) are chosen
in **Hồ sơ → Giao diện** or on the login screen and saved as `agentra-locale`. Wrap every
interface string in `t('…')` (or `msg('…')` for constants) from `@/lib/i18n/core`; the
Vietnamese text is the message ID and `{name}` marks parameters. Catalogues live in
`src/lib/i18n/locales/<code>.json` and load lazily; `src/test/i18n_catalogs.test.ts`
fails when a catalogue misses a message, has an extra key or changes a placeholder.
Business data (names, wards, notes, document codes) is never translated and money is
always VND. Use logical CSS utilities (`ms/me/ps/pe/start/end/text-start`) so Arabic and
Urdu render right-to-left. Terminology: `openwiki/frontend-design/plan/i18n/GLOSSARY.md`.

## Docker

The multi-stage Dockerfile builds static assets and serves them with unprivileged
Nginx on port 8080. Nginx provides SPA fallback, asset caching, and `/api/` proxying
to the `backend` service on the Compose network. Run from the repository root:

```sh
docker compose up --build -d --wait --wait-timeout 120
```

Compose waits for backend database readiness before starting the frontend. Fill
in `backend/.env` with valid Supabase settings first. The frontend health check
verifies writable cache storage, the compiled index, Nginx `/healthz`, and proxied
API/database readiness. Probes run every 30 seconds with a 15-second timeout, three
retries, 20-second startup grace period and five-second startup intervals. `/healthz`
by itself checks only Nginx liveness. Use Engine 25+/Compose 2.20.2+ for startup intervals.

Repository-root `data/frontend/` is bind-mounted to `/var/cache/nginx`; Nginx stores
request-body and upstream-response buffers under `client_temp/` and `proxy_temp/`.
Compiled assets come from the image. The entire root `data/` directory is Git-ignored
and host files survive container recreation. On Linux, grant the current Nginx
UID/GID `101:101` ownership of the host directory; Docker Desktop on Windows provides
writable shared folders. Logs use Docker stdout/stderr rotation (10 MB, three files).

For a separate API deployment, set `VITE_API_BASE_URL` in the shell or root `.env`
to override the Docker build argument and configure CORS. `ui/.env` configures
local Vite, not Compose build arguments. The API documentation link uses the default
same-origin `/api/docs` route. See the root README for environment setup.
