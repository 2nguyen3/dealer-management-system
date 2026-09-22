# Agentra frontend

React 19 + Vite + strict TypeScript, ESLint, and Prettier. Use Node.js 24 LTS
(minimum 22.12) and npm. Commit `package-lock.json` when dependencies change.

## Local development

From `ui/`:

```sh
npm ci
npm run dev
```

Open http://localhost:5173. Run the backend on port 8000 in a second terminal.
Vite proxies `/api` to FastAPI so local requests use the same origin.

The starter page checks API liveness and links to Swagger UI. It does not check
the database; use `/api/v1/health/ready` to verify Supabase connectivity.

The default API base URL is `/api/v1`. To override it, copy `.env.example` to
`.env` and set `VITE_API_BASE_URL`. Vite variables are public and are embedded
at build time. Never put database credentials or service-role keys in them.
An external API origin also needs the frontend origin in backend `CORS_ORIGINS`.

## Structure

```text
src/
  app/          # Application composition
  lib/          # Shared infrastructure, including API calls
  main.tsx      # React entry point
  styles.css    # Global styles
```

Group future features under `src/features/<feature>/`, keeping their components,
hooks, and types together. Promote code to shared modules when it is reused.

## Commands

```sh
npm run lint
npm run typecheck
npm run format:check
npm run build
npm run preview
```

`preview` serves a local production build; it is not a production server and
does not provide the development API proxy. Use Docker Compose for a full-stack
production-build smoke test. `npm run format` applies Prettier formatting.

## Docker

The multi-stage Dockerfile builds static assets and serves them with unprivileged
Nginx on port 8080. Nginx provides SPA fallback, asset caching, and `/api/` proxying
to the `backend` service on the Compose network. Run from the repository root:

```sh
docker compose up --build -d --wait --wait-timeout 120
```

Compose waits for backend database readiness before starting the frontend. Fill
in `backend/.env` with valid Supabase settings first. The frontend's own health
check calls Nginx `/healthz`.

For a separate API deployment, set `VITE_API_BASE_URL` in the shell or root `.env`
to override the Docker build argument and configure CORS. `ui/.env` configures
local Vite, not Compose build arguments. The API documentation link uses the default
same-origin `/api/docs` route. See the root README for environment setup.
