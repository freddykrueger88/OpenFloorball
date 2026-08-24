# 📚 Architecture Overview

*[🇩🇪 Deutsch](Architektur.md) | 🇬🇧 English*

## 📱 Tech stack

### Backend
| Technology | Version | Purpose |
|---|---|---|
| Node.js | 24 (Active LTS) | Runtime |
| Express.js | 5.x | HTTP framework |
| PostgreSQL | 18 | Database |
| Redis | 8 | Session/token blacklist cache |
| bcrypt | 6.x | Password hashing |
| jsonwebtoken | 9.x | JWT auth |
| FFmpeg | – | GIF/MP4 export (bundled in the Docker image) |
| pdfkit | 0.19.x | PDF tactics sheet export |
| nodemailer | 9.x | Optional SMTP mail delivery (collaborator notifications), see [Email delivery](./E-Mail-Versand.en.md) |

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| React | 19 | UI framework |
| Vite | 7 | Build tool |
| Konva.js / react-konva | 10 / 19 | Canvas/2D rendering |
| Zustand | 5 | State management |
| React Router | 8 | Routing |
| i18next / react-i18next | 26 / 17 | Internationalization |
| vite-plugin-pwa | 1.x | Service worker / offline mode |

> Icons are rendered via Unicode/emoji, no icon library in use.
> Vite 8 and ESLint 10 (frontend) are deliberately deferred – see
> [CHANGELOG](../../CHANGELOG.md) for the reasons (peer-dependency
> conflicts in the respective ecosystem).

### Infrastructure
| Technology | Purpose |
|---|---|
| Docker Compose | Multi-container orchestration |
| Nginx | Frontend serving + API proxy |
| GitHub Actions | CI/CD pipeline |
| Caddy (optional) | TLS termination/reverse proxy, see `docker-compose.tls.yml` |

## 🏛️ Container architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                  Docker Network (openfloorball_internal)            │
│                                                                    │
│  ┌────────────┐      ┌────────────┐      ┌────────────┐          │
│  │  Frontend  │ ───▶ │  Backend   │ ───▶ │ PostgreSQL │          │
│  │ Nginx :80  │      │ Node :3001 │      │  :5432     │          │
│  └────────────┘      └─────┬──────┘      └────────────┘          │
│    :${APP_PORT}             │                                    │
│    (host port,              ▼                                    │
│     default 80)       ┌────────────┐                             │
│                       │   Redis    │                             │
│                       │   :6379    │                             │
│                       └────────────┘                             │
└──────────────────────────────────────────────────────────────────┘
```

Only `frontend` binds a host port (`APP_PORT`, default `80`); backend,
Postgres, and Redis are reachable exclusively over the internal Docker
network, never directly from the host. Persistent volumes:
`db_data_pg18` (Postgres data), `redis_data`, `exports_data`
(temporary GIF/MP4/PDF files, 24h retention), `backups_data`
(automatic admin backups).

## 🔄 Data flow: GIF/MP4 export

```
Coach clicks "Export"
  ↓
Frontend renders each frame offscreen as PNG (Konva.js, no DOM)
  ↓
PNGs sent to backend as Base64 (POST /api/export/gif or /api/export/mp4)
  ↓
Backend writes PNGs temporarily to /app/exports/<jobId>/
  ↓
FFmpeg combines PNGs into GIF/MP4 (async job, polled via
GET /api/export/status/:id)
  ↓
Download via GET /api/export/download/:id
  ↓
Hourly cleanup job removes exports older than 24h
```

PDF tactics sheets (`POST /api/export/pdf`) and training plan PDFs run
synchronously without a job store: the PNGs already rendered by the
client are placed directly into a PDF via `pdfkit` and streamed.

## 🗄️ Data model (brief overview)

All tables are Postgres, migrations are idempotent via
`backend/src/db/migrate.js` (runs again on every backend start,
`CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`):

- `users`, `settings` – account & preferences
- `boards`, `frames` – core tactics data (a board has multiple frames
  for animation)
- `board_versions` – automatic snapshots on every frame change (max.
  50/board, oldest get evicted), enables restore
- `board_collaborators`, `board_invites` – board sharing for
  registered and not-yet-registered people (Issue #51 MVP)
- `board_videos` – video integration (the file lives on disk, metadata/
  drawing overlay/trim/markers live here in the DB)
- `comments` – comments on boards and training sessions
- `playbooks` – board collections (Issue #52)
- `formation_templates` – reusable lineups (Issue #46)
- `training_sessions`, `training_session_items` – training planner,
  references boards by foreign key instead of copying (Issue #45)
- `roster_players` – central team roster (Issue #53)
- `lines`, `line_players` – lines as tactical roster-player
  combinations, `line_players` as a many-to-many junction (a player
  can be in any number of lines, a deliberate domain redesign)
- `games` – live game notes (opponent/date), the notes themselves run
  through `comments` with `resource_type='game'`
- `teams`, `team_members` – teams with a role model
- `organizations`, `organization_members` – clubs with multiple teams
- `library_entries`, `library_entry_reports` – community library
  (snapshot copies of published boards) and reports on them
- `exports` – metadata for share links (board and frame level,
  expiry, token)
- `app_config` – global singleton configuration (incl. backup
  schedule, AI provider configuration)

## 🔌 AI provider (optional)

Four text-based assistants (see [AI assistants](./KI-Assistenten.en.md))
talk to any OpenAI-compatible `/v1/chat/completions` endpoint through a
swappable adapter (`app_config` table or `AI_PROVIDER_*` env vars).
Without configuration, the corresponding buttons simply aren't visible
in the frontend – no error state, no hard dependency on a specific
provider.

## 🟢 Real-time collaboration

A dedicated WebSocket server (not part of the REST API under `/api`,
see `services/presenceServer.js`) broadcasts presence badges and live
cursor positions per board "room". Authenticated via the same
HttpOnly session cookie as the REST API. Deliberately **no**
server-side conflict resolution or persistence – see
[Real-time collaboration](./Echtzeit-Zusammenarbeit.en.md).

## 📶 Offline mode (PWA)

A service worker (Workbox via `vite-plugin-pwa`) caches the app shell
and GET responses to `/api/boards*` etc. (`NetworkFirst`, explicitly
**not** `/api/auth`, `/api/admin`, `/api/user/export` – data
minimization). Write operations (PUT/DELETE on existing resources)
that fail offline land in an IndexedDB queue
(`frontend/src/utils/offlineQueue.js`) and are automatically retried
on the `online` event (last-write-wins per resource). Creating new
resources (POST) is deliberately not buffered offline.

## Further reading

- [Frontend structure](./Frontend.en.md) – pages, components, hooks, stores
- [API documentation](./API.en.md) – full endpoint reference
- [Environment variables](./Umgebungsvariablen.en.md)
