# 🛠️ Manuelle Installation (Entwicklung)

*🇩🇪 Deutsch | [🇬🇧 English](Installation-Entwicklung.en.md)*

Für iterative Frontend-/Backend-Entwicklung ohne Container-Rebuild bei
jeder Änderung. Für den reinen Produktivbetrieb siehe
[Schnellstart mit Docker](./Installation-Docker.md).

## Voraussetzungen

| Komponente | Mindestversion |
|---|---|
| Node.js (Backend) | ≥ 24 |
| Node.js (Frontend) | ≥ 22.22 |
| PostgreSQL | 18 |
| Redis | 8 |

Läuft eine passende Node-Version bereits lokal, reicht ein einziges
Node ≥ 24 für beide Seiten.

## 1. Datenbank + Redis bereitstellen

Am einfachsten weiterhin über Docker, nur die Infrastruktur-Services:

```bash
docker compose up -d db redis
```

## 2. Backend

```bash
cd backend
npm install
cp ../.env.example .env   # anpassen: DB_HOST=localhost, REDIS_HOST=localhost
npm run dev                # node --watch, Neustart bei Dateiänderung
```

Nützliche Skripte:

```bash
npm run db:migrate   # Migrationen manuell ausführen (läuft sonst automatisch beim Start)
npm run db:seed      # Testdaten (NICHT in production ausführen)
npm test              # Jest-Suite (siehe Voraussetzungen unten)
npm run lint          # ESLint --max-warnings=0
```

## 3. Frontend

```bash
cd frontend
npm install
npm run dev   # Vite Dev-Server, Standard: http://localhost:5173
```

Der Vite-Dev-Server proxied `/api`-Aufrufe nicht automatisch auf das
Backend – für lokale Entwicklung `VITE_API_URL` in `frontend/.env`
auf die Backend-URL setzen (z. B. `http://localhost:3001/api`) oder
CORS_ORIGIN im Backend passend auf `http://localhost:5173` setzen.

## Tests lokal ausführen

Backend-Tests brauchen eine eigene Postgres-/Redis-Instanz (nicht die
Produktivdaten verwenden!). Zwei Docker-Wegwerfcontainer sind der
einfachste Weg:

```bash
docker run -d --name ff_test_pg -e POSTGRES_DB=openfloorball_test \
  -e POSTGRES_USER=ff -e POSTGRES_PASSWORD=test -p 5432:5432 postgres:18-alpine
docker run -d --name ff_test_redis -p 6379:6379 redis:8-alpine \
  redis-server --requirepass test
```

Danach `DB_*`/`REDIS_*` in `backend/.env.test` bzw. der Shell auf
diese Container zeigen lassen und `npm test` ausführen. Aufräumen mit
`docker rm -f -v ff_test_pg ff_test_redis` (`-v` wichtig, sonst
bleiben anonyme Volumes zurück).

Das Frontend hat aktuell keine eigene Test-Suite – `npm run lint` und
`npm run build` sind das Regressionsnetz.

## Weiterführend

- [Umgebungsvariablen](./Umgebungsvariablen.md)
- [Architektur-Übersicht](./Architektur.md)
- [Contributing Guide](./Contributing.md)
