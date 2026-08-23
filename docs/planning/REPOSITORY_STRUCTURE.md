# REPOSITORY_STRUCTURE.md

# OpenFloorball Coach Platform

## Tatsächliche Projektstruktur

---

> **Hinweis zur Historie:** Diese Datei beschrieb ursprünglich eine
> geplante Monorepo-Struktur (`apps/`, `packages/`, `database/`,
> `tests/`, `infrastructure/`), die nie umgesetzt wurde. Die folgende
> Fassung beschreibt stattdessen die **tatsächliche, aktuelle**
> Struktur des Repositories – weiterhin die kanonische Quelle für die
> Ordnerstruktur, jetzt aber deckungsgleich mit dem Code statt einer
> Zukunftsvision.

---

# 1. Grundprinzip

Einfache Zwei-Anwendungen-Struktur statt Monorepo: ein Backend
(Node/Express/PostgreSQL) und ein Frontend (React/Vite), jeweils mit
eigenem `package.json`. Kein `apps/`- oder `packages/`-Wrapper, keine
gemeinsam genutzten npm-Pakete zwischen den beiden – geteilte Logik
(z. B. Feldmaße, Farbkonstanten) wird bewusst in beiden Projekten
separat gehalten, um keine dritte Build-Pipeline für ein internes
Shared-Package zu benötigen.

---

# 2. Hauptstruktur

```text
OpenFloorball/
├── README.md
├── LICENSE
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── SECURITY.md
├── CHANGELOG.md
├── CLAUDE.md
├── docker-compose.yml
├── docker-compose.tls.yml
├── Caddyfile
├── .env.example
├── backend/
├── frontend/
├── docs/
├── scripts/
└── .github/
```

---

# 3. `backend/` – Node/Express/PostgreSQL

```text
backend/
├── src/
│   ├── server.js          # Express-App, Middleware, Routen-Mounting
│   ├── routes/            # Ein Express-Router pro Ressource
│   ├── controllers/       # Handler-Funktionen, je Ressource eine Datei
│   ├── services/          # Cron-Jobs (Backup), KI-Adapter/Prompts,
│   │                         WebSocket-Presence-Server
│   ├── middleware/        # authenticate, validate, requireAdmin, …
│   ├── utils/              # apiResponse, boardAccess, teamAccess, …
│   ├── constants/          # feste Werte (z. B. Standard-Positionen)
│   ├── db/                 # pool.js (pg-Pool), migrate.js
│   │                         (idempotente Migrationen, laufen bei
│   │                         jedem Start erneut)
│   └── __tests__/          # Jest-Tests, ein File pro Ressource
├── Dockerfile
└── package.json
```

Muster: `routes/<ressource>.js` validiert (express-validator) und
delegiert an `controllers/<ressource>Controller.js`. Keine separate
Model-/ORM-Schicht – Controller sprechen direkt per SQL mit `pg`.

---

# 4. `frontend/` – React/Vite

```text
frontend/
├── src/
│   ├── pages/              # Eine Datei pro Route (siehe App.jsx)
│   ├── components/         # Nach Feature-Bereich gruppiert
│   │                         (board/, layout/, settings/, a11y/, …)
│   ├── hooks/               # useXApi-Hooks kapseln fetch-Aufrufe
│   ├── store/                # Zustand-Stores (auth, offline, tour, …)
│   ├── utils/                 # apiFetch, offlineQueue/-Sync, …
│   ├── i18n/                   # locales/de.json, locales/en.json
│   ├── constants/               # Feldmaße, Farbpaletten
│   ├── styles/                   # globale CSS-Variablen/Tokens
│   ├── App.jsx                    # Routing (react-router), globale
│   │                                 Provider (Header, TourOverlay,
│   │                                 OfflineBanner, …)
│   └── main.jsx
├── vite.config.js            # inkl. PWA-Konfiguration (vite-plugin-pwa)
├── Dockerfile
└── package.json
```

Muster: jede Seite in `pages/` holt ihre Daten selbst über einen
`useXApi`-Hook aus `hooks/` – kein zentrales Prop-Drilling von
`App.jsx` aus.

---

# 5. `docs/`

```text
docs/
├── IFF-RULES.md            # Floorball-Regelwerk-Referenz
├── planning/                # Vision, Architektur-Entscheidungen,
│                              Backlog – aspirativ/konzeptionell,
│                              KEIN Live-Statustracker
└── wiki/                     # Gepflegtes Benutzer-/Entwickler-Wiki
                               (Installation, Features, API, …),
                               siehe docs/wiki/Home.md
```

Für den aktuellen, faktischen Entwicklungsstand siehe stattdessen
**[docs/current-status.md](../current-status.md)**.

---

# 6. `scripts/`

Eigenständige Node-Skripte außerhalb der beiden Hauptanwendungen
(z. B. ein Fake-KI-Server zum Testen der KI-Assistenten ohne echten
Anbieter). Kein Build-Schritt, direkt mit `node` ausführbar.

---

# 7. `.github/`

```text
.github/
├── workflows/               # ci.yml, security.yml, …
├── ISSUE_TEMPLATE/
├── PULL_REQUEST_TEMPLATE.md
└── labels.yml
```

---

# 8. Was es bewusst NICHT gibt

- Kein `apps/`- oder `packages/`-Monorepo-Layout.
- Kein separates `database/`-Verzeichnis – Migrationen liegen in
  `backend/src/db/migrate.js`, ein einziges idempotentes Skript statt
  einer Migrationshistorie mit Einzeldateien.
- Kein `tests/`-Verzeichnis auf Root-Ebene – Tests liegen jeweils im
  betroffenen Projekt (`backend/src/__tests__/`, Frontend-Tests
  co-located neben der jeweiligen Quelldatei).
- Kein `infrastructure/`-Verzeichnis – Docker-/Deployment-Konfiguration
  liegt direkt auf Root-Ebene (`docker-compose*.yml`, `Caddyfile`).
- Kein `examples/`-Verzeichnis mit Demo-Daten.

---

# 9. Namenskonventionen

Wie im Code bereits durchgängig verwendet:

- Backend: `camelCase.js` (z. B. `boardsController.js`), ein
  Controller/Route-Paar pro Ressource.
- Frontend: `PascalCase.jsx` für Komponenten (z. B.
  `BoardEditorPage.jsx`), `useCamelCase.js` für Hooks (z. B.
  `useBoardsApi.js`), `camelCase.js` für Utilities/Stores.
- Tests: `<name>.test.js` neben bzw. im `__tests__/`-Ordner der
  getesteten Datei.

---

# 10. Vor dem Anlegen neuer Dateien prüfen

- Gibt es bereits ein passendes `useXApi.js`/`xController.js`-Paar,
  das erweitert werden kann, statt ein neues zu erstellen?
- Passt eine neue Doku-Seite besser in `docs/wiki/` (Benutzer-/
  Entwickler-Dokumentation) oder `docs/planning/` (Vision/Konzept)?
- Wird `docs/current-status.md` durch die Änderung unrichtig und muss
  mitgepflegt werden?
