# 🏒 OpenFloorball

*[🇩🇪 Deutsch](README.md) | 🇬🇧 English*

**Self-hosted tactics board and coaching platform for floorball**

[![CI](https://github.com/freddykrueger88/OpenFloorball/actions/workflows/ci.yml/badge.svg)](https://github.com/freddykrueger88/OpenFloorball/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/freddykrueger88/OpenFloorball)](https://github.com/freddykrueger88/OpenFloorball/blob/main/LICENSE)
[![Docker](https://img.shields.io/badge/docker-ready-blue)](https://hub.docker.com/)
[![GitHub issues](https://img.shields.io/github/issues/freddykrueger88/OpenFloorball)](https://github.com/freddykrueger88/OpenFloorball/issues)

> **Version:** 0.9.0 · **Status:** Active development, in production
> use · **Stack:** React/Vite · Node/Express · PostgreSQL · Redis ·
> Docker

Detailed, continuously updated status (German):
**[docs/current-status.md](docs/current-status.md)**

---

## 📋 Table of contents

- [What is OpenFloorball?](#-what-is-openfloorball)
- [Screenshots](#-screenshots)
- [Current status](#-current-status)
- [Features](#-features)
- [Roadmap](#-roadmap)
- [Installation](#-installation)
- [Development](#-development)
- [Architecture](#-architecture)
- [Project structure](#-project-structure)
- [Documentation](#-documentation)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🤔 What is OpenFloorball?

OpenFloorball is a digital tactics board for floorball coaches: field,
players, and plays can be placed on screen, drawn, played back as an
animation, and shared as GIF/MP4/PDF/link. Beyond that, the platform
covers the rest of the coaching workflow – training planning, roster
management, team/club structure, an exercise library for sharing with
other clubs, and optional AI assistance for training planning, tactic
variants, and analysis.

The platform is self-hosted (Docker Compose), not a vendor's cloud
service – your data stays on your own infrastructure.

## 📸 Screenshots

<table>
<tr>
<td width="50%"><img src="docs/screenshots/02-board-editor-taktik.png" alt="Board editor with a drawn tactic" /></td>
<td width="50%"><img src="docs/screenshots/07-ki-wissensassistent.png" alt="AI knowledge assistant with sources" /></td>
</tr>
</table>

More views (training planner, roster, community library, mobile use):
**[docs/wiki/Screenshots.en.md](docs/wiki/Screenshots.en.md)**

## 📊 Current status

The core (tactics board, animation, export) is stable and in use.
Around that core, a training planner, team/club management, community
library, four AI assistants, video integration, real-time presence
(live cursors), a password reset flow, and a two-part onboarding tour
(navigation + board editor) are already implemented. Offline conflict
detection doesn't yet cover every resource. Details, limitations, and
known issues (German): **[docs/current-status.md](docs/current-status.md)**.

## ✨ Features

| Area | Status | Details |
|---|---|---|
| Tactics board (field, drawing, frame animation, versioning) | ✅ | [Drawing plays](docs/wiki/Spielzuege-Zeichnen.en.md), [Animation](docs/wiki/Animation.en.md) |
| Formation templates, playbooks | ✅ | [Formations](docs/wiki/Formationen.en.md), [Playbooks](docs/wiki/Playbooks.en.md) |
| Training planner, roster, lines | ✅ | [Training planner](docs/wiki/Trainingsplaner.en.md), [Roster](docs/wiki/Kader.en.md), [Lines](docs/wiki/Lines.en.md) |
| Live game notes | ✅ | [Live game notes](docs/wiki/Live-Spielnotizen.en.md) |
| Teams and clubs | ✅ | [Teams and clubs](docs/wiki/Teams-und-Vereine.en.md) |
| Board sharing (collaborators, invites, links) | ✅ | [Export & sharing](docs/wiki/Export.en.md) |
| Community exercise library | ✅ | [Community library](docs/wiki/Community-Bibliothek.en.md) |
| AI assistants (training/tactics/analysis/knowledge, optional) | ✅ | [AI assistants](docs/wiki/KI-Assistenten.en.md) |
| Video integration (upload, drawing overlay, trimming, markers, video→board) | ✅ | [Video integration](docs/wiki/Video-Integration.en.md) |
| Real-time presence (live cursors) | ✅ | [Real-time collaboration](docs/wiki/Echtzeit-Zusammenarbeit.en.md) |
| Export as GIF/MP4/PDF | ✅ | [Export & sharing](docs/wiki/Export.en.md) |
| PWA / offline mode | 🟡 | Conflict detection only for boards/frames/trainings/roster, see [Offline mode](docs/wiki/Offline-Modus.en.md) |
| Onboarding tour | ✅ | On first login, skippable |
| In-depth editor tour | ✅ | In the board editor, independent of the onboarding tour, re-openable via the help icon |
| GDPR (export, deletion, backup) | ✅ | [Privacy](docs/wiki/Datenschutz.en.md), [Backup](docs/wiki/Backup.en.md) |
| Accessibility | ✅ | Colorblind filters, screen reader, keyboard, font sizes |
| Password reset | ✅ | Via email link, requires configured SMTP delivery |
| Language | ✅ | German (default) and English in the UI, more languages in progress – see [Contributing a translation](#-contributing) |

## 🗺️ Roadmap

**Done** (excerpt, full history in [CHANGELOG](CHANGELOG.md)):
Tactics board core, training planner, roster-based lines, live game
notes, teams/clubs, community library, AI assistants, video
integration (incl. video → tactics board), real-time presence,
onboarding tour, in-depth editor tour, extended offline conflict
resolution, password reset flow, manual backup trigger, German/English
UI localization.

**In progress:** no feature currently in a visibly unfinished state –
see [docs/current-status.md](docs/current-status.md) (German) for the
continuously updated status.

**Planned** (excerpt from [docs/planning/BACKLOG.md](docs/planning/BACKLOG.md)):
- Native app store presence (PWA wrapper)
- Vite 8 / ESLint 10 upgrade (currently blocked by peer-dependency conflicts)
- More UI languages, prioritized by actual floorball activity (Swedish, Finnish, Czech, Slovak first) – see [ISSUE 027](docs/planning/BACKLOG.md)

## 🚀 Installation

### Requirements

- Docker and Docker Compose
- A server or local machine to host it on

### Quick start with Docker

```bash
git clone https://github.com/freddykrueger88/OpenFloorball.git
cd OpenFloorball
cp .env.example .env
```

**Edit `.env` before starting** – at minimum `DB_PASSWORD`,
`REDIS_PASSWORD`, and `JWT_SECRET` must be set, otherwise Docker
Compose refuses to start (deliberately hard-required fields, no
insecure defaults). All variables are documented in
[docs/wiki/Umgebungsvariablen.en.md](docs/wiki/Umgebungsvariablen.en.md).

```bash
docker compose up -d
```

Starts four containers: `frontend` (Nginx, the only host port),
`backend` (Node/Express), `db` (PostgreSQL), and `redis` – backend,
DB, and Redis are only reachable inside the Docker network.

Then open in your browser: `http://localhost:${APP_PORT:-3000}`

### Optional: TLS/HTTPS for production use

```bash
DOMAIN=your-domain.com docker compose -f docker-compose.yml -f docker-compose.tls.yml up -d
```

Details: [docs/wiki/Installation-Docker.en.md](docs/wiki/Installation-Docker.en.md)

## 👨‍💻 Development

No local Node.js needed – backend and frontend each run in their own
containers; lint/test/build also run containerized (see
[docs/wiki/Installation-Entwicklung.en.md](docs/wiki/Installation-Entwicklung.en.md)
for the full workflow including live reload).

```bash
# Backend: lint & tests
docker run --rm -v $(pwd)/backend:/app -w /app node:24-alpine \
  sh -c "npm install && npm run lint && npm test"

# Frontend: lint, tests & build
docker run --rm -v $(pwd)/frontend:/app -w /app node:24-alpine \
  sh -c "npm install && npm run lint && npm test && npm run build"

# After code changes: rebuild and restart the affected service
docker compose build backend   # or: frontend
docker compose up -d backend
```

The same lint/test steps also run in CI (GitHub Actions, see badge
above).

## 🏛️ Architecture

```mermaid
flowchart LR
    A["Frontend<br/>React + PWA"] -->|REST /api| B["Backend<br/>Express"]
    A -->|WebSocket| E["Presence server<br/>Live cursors"]
    B --> C[("PostgreSQL")]
    B --> D[("Redis<br/>Session blacklist")]
    E --> B
```

Details incl. data model, export data flow, and AI provider
integration: [docs/wiki/Architektur.en.md](docs/wiki/Architektur.en.md)

## 📁 Project structure

```text
OpenFloorball/
├── backend/     # Node/Express API, PostgreSQL migrations, tests
├── frontend/    # React/Vite PWA
├── docs/
│   ├── planning/   # Vision, architecture decisions, backlog
│   └── wiki/       # User and developer documentation
├── scripts/     # Standalone helper scripts (e.g. test AI server)
├── docker-compose.yml
└── docker-compose.tls.yml   # optional TLS overlay (Caddy)
```

Full, current structure with rationale:
[docs/planning/REPOSITORY_STRUCTURE.md](docs/planning/REPOSITORY_STRUCTURE.md) (German)

## 📚 Documentation

> **Note:** the deeper planning docs (`docs/planning/`) – architecture
> decisions, product vision, backlog – along with
> `docs/current-status.md` and `CHANGELOG.md` are currently
> German-only. The project wiki (`docs/wiki/`) is fully bilingual, like
> the application UI itself. Contributions welcome, see
> [Contributing](#-contributing).

- **[docs/wiki/Home.en.md](docs/wiki/Home.en.md)** – full wiki
  (installation, every feature in detail, API reference, architecture)
- **[docs/current-status.md](docs/current-status.md)** – detailed
  current status, known issues, next steps – German
- **[CHANGELOG.md](CHANGELOG.md)** – full version history – German

## 🤝 Contributing

Contributions are welcome – read [CONTRIBUTING.md](CONTRIBUTING.md)
first (German). Code of conduct: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
Please report security vulnerabilities per [SECURITY.md](SECURITY.md),
not as a public issue.

Want to help translate the app into your language? Start here:
**[docs/TRANSLATING.en.md](docs/TRANSLATING.en.md)** – no external
translation tool needed, just a text editor and one test command.

## 📄 License

MIT License – see [LICENSE](LICENSE).

---

<p align="center">
  <em>OpenFloorball – because tactics is more than just chalk on the board.</em>
</p>
