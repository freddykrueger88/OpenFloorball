# AGENTS.md

## What This Is

Self-hosted floorball coaching platform: React/Vite PWA frontend + Express REST API backend + PostgreSQL + Redis. All plain JavaScript (ES Modules), no TypeScript. See `CLAUDE.md` for product vision and non-negotiable principles.

## Project Layout

- `frontend/` — React 19, Vite 8, Zustand, Konva canvas, i18n (de/en/sv)
- `backend/` — Express 5, Node 24, pg, redis, ws, JWT auth
- `docs/` — Planning docs and wiki (mostly German)
- `scripts/` — Dev helpers (fake-ai-server.js)
- No root `package.json` — frontend and backend are independent npm projects

## Developer Commands

### Backend (`backend/`)

```bash
npm install
npm run db:migrate      # idempotent, safe to re-run
npm run db:seed         # demo user: admin@openfloorball.local / Admin1234!
npm run dev             # node --watch src/server.js, port 3001
npm run test            # jest --runInBand --forceExit
npm run lint            # eslint src --max-warnings=0
```

### Frontend (`frontend/`)

```bash
npm install
npm run dev             # vite dev server on port 5173, proxies /api to backend:3001
npm run test            # vitest run
npm run lint            # eslint src --max-warnings=0
npm run build           # production build, no sourcemaps
```

### Docker

```bash
cp .env.example .env    # edit secrets before first run
docker compose up -d    # 4 services: frontend(nginx), backend, postgres, redis
```

TLS variant: `docker compose -f docker-compose.yml -f docker-compose.tls.yml up -d` (requires `DOMAIN` in `.env`).

## CI Order

GitHub Actions `ci.yml` runs **lint → test** for backend and frontend in parallel, then builds Docker images. Both lint commands use `--max-warnings=0` so any warning is a failure.

## Test Requirements

- **Backend tests need PostgreSQL and Redis running.** CI uses service containers. Locally, use Docker Compose or point to existing instances via `.env`.
- **Backend export tests need FFmpeg** installed on the system.
- **Backend Jest** uses `--runInBand` (serial) with 10s timeout.
- **Frontend Vitest** uses jsdom environment, no globals mode (explicit imports).
- Test files live alongside source in `__tests__/` (backend) or colocated (frontend).

## Key Conventions

- **No TypeScript, no Prettier.** Code style enforced only by ESLint flat config.
- **ES Modules everywhere.** `"type": "module"` in both package.json files.
- **Import extensions required** in backend (`.js` extensions on relative imports).
- **Backend: no `React` import needed.** Frontend JSX has `react/React-in-jsx-scope` disabled.
- **Unused vars:** warn-level, prefix with `_` to suppress (both sides).
- **Backend auth is cookie-based.** JWT stored in httpOnly cookie named `token`, not Bearer header.
- **Database migrations are monolithic.** Single file `backend/src/db/migrate.js` runs on every startup with `IF NOT EXISTS` guards. Safe to re-run.
- **Node versions differ:** backend requires `>=24.0.0`, frontend requires `>=22.22.0`.

## Environment Files

Three `.env` files exist with different values:

| File | Purpose | Key difference |
|------|---------|----------------|
| `.env` (root) | Docker Compose | CORS_ORIGIN → frontend container |
| `backend/.env` | Local dev server | CORS_ORIGIN → `http://localhost:5173` |
| `.env.example` | Template | All vars documented |

Backend reads its own `.env` via `dotenv`. Docker Compose passes root `.env` to the container.

## Architecture Notes

- **Backend entry:** `backend/src/server.js` — Express app, route registration, DB migration on startup, WebSocket presence server
- **Frontend entry:** `frontend/src/App.jsx` — routing with auth guards, session restore, offline sync
- **Canvas/tactics board** uses Konva (react-konva) — drawing, animation frames, export to GIF/MP4/PDF
- **AI features are optional.** Backend `ai/` directory has a provider abstraction; `scripts/fake-ai-server.js` for local testing without API keys.
- **PWA with offline support.** Frontend uses vite-plugin-pwa with NetworkFirst for API calls. An offline queue syncs mutations when reconnected.
- **i18n completeness** is tested — see locale test files. All three locales (de, en, sv) must stay in sync.

## Gotchas

- Running `npm test` in backend without Postgres/Redis will fail with connection errors, not test assertion errors.
- The `--forceExit` flag on Jest is intentional — some async resources (DB pool, Redis) don't close cleanly.
- Frontend build disables sourcemaps (`build.sourcemap: false`).
- Backend uses Express 5 — async route handlers don't need try/catch wrappers (errors propagate automatically).
- Soft deletes on boards — rows are not removed, filtered by `deleted_at IS NULL`.
