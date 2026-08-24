# 🛠️ Manual Installation (Development)

*[🇩🇪 Deutsch](Installation-Entwicklung.md) | 🇬🇧 English*

For iterative frontend/backend development without rebuilding
containers on every change. For plain production use, see
[Quick start with Docker](./Installation-Docker.en.md).

## Requirements

| Component | Minimum version |
|---|---|
| Node.js (backend) | ≥ 24 |
| Node.js (frontend) | ≥ 22.22 |
| PostgreSQL | 18 |
| Redis | 8 |

If a suitable Node version is already installed locally, a single
Node ≥ 24 covers both sides.

## 1. Provide the database + Redis

Still easiest via Docker, just the infrastructure services:

```bash
docker compose up -d db redis
```

## 2. Backend

```bash
cd backend
npm install
cp ../.env.example .env   # adjust: DB_HOST=localhost, REDIS_HOST=localhost
npm run dev                # node --watch, restarts on file changes
```

Useful scripts:

```bash
npm run db:migrate   # run migrations manually (otherwise runs automatically on start)
npm run db:seed      # test data (do NOT run in production)
npm test              # Jest suite (see requirements below)
npm run lint          # ESLint --max-warnings=0
```

## 3. Frontend

```bash
cd frontend
npm install
npm run dev   # Vite dev server, default: http://localhost:5173
```

The Vite dev server doesn't automatically proxy `/api` calls to the
backend – for local development, either set `VITE_API_URL` in
`frontend/.env` to the backend URL (e.g. `http://localhost:3001/api`)
or set `CORS_ORIGIN` in the backend to `http://localhost:5173`.

## Running tests locally

Backend tests need their own Postgres/Redis instance (don't use
production data!). Two throwaway Docker containers are the easiest
way:

```bash
docker run -d --name ff_test_pg -e POSTGRES_DB=openfloorball_test \
  -e POSTGRES_USER=ff -e POSTGRES_PASSWORD=test -p 5432:5432 postgres:18-alpine
docker run -d --name ff_test_redis -p 6379:6379 redis:8-alpine \
  redis-server --requirepass test
```

Then point `DB_*`/`REDIS_*` in `backend/.env.test` (or your shell) at
these containers and run `npm test`. Clean up with
`docker rm -f -v ff_test_pg ff_test_redis` (`-v` matters, otherwise
anonymous volumes are left behind).

The frontend currently has no dedicated test suite – `npm run lint`
and `npm run build` are the regression safety net.

## Further reading

- [Environment variables](./Umgebungsvariablen.en.md)
- [Architecture overview](./Architektur.en.md)
- [Contributing guide](./Contributing.en.md)
