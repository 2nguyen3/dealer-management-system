# DMS frontend

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
