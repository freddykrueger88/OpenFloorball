# 📚 Architektur-Übersicht

*🇩🇪 Deutsch | [🇬🇧 English](Architektur.en.md)*

## 📱 Tech Stack

### Backend
| Technologie | Version | Zweck |
|---|---|---|
| Node.js | 24 (Active LTS) | Laufzeitumgebung |
| Express.js | 5.x | HTTP Framework |
| PostgreSQL | 18 | Datenbank |
| Redis | 8 | Session-/Token-Blacklist-Cache |
| bcrypt | 6.x | Passwort-Hashing |
| jsonwebtoken | 9.x | JWT Auth |
| FFmpeg | – | GIF-/MP4-Export (im Docker-Image gebündelt) |
| pdfkit | 0.19.x | PDF-Taktikblatt-Export |
| nodemailer | 9.x | Optionaler SMTP-Mailversand (Kollaborator-Benachrichtigung), siehe [E-Mail-Versand](./E-Mail-Versand.md) |

### Frontend
| Technologie | Version | Zweck |
|---|---|---|
| React | 19 | UI Framework |
| Vite | 7 | Build Tool |
| Konva.js / react-konva | 10 / 19 | Canvas/2D Rendering |
| Zustand | 5 | State Management |
| React Router | 8 | Routing |
| i18next / react-i18next | 26 / 17 | Internationalisierung |
| vite-plugin-pwa | 1.x | Service Worker / Offline-Modus |

> Icons werden über Unicode/Emoji dargestellt, keine Icon-Bibliothek im Einsatz.
> Vite 8 und ESLint 10 (Frontend) sind bewusst zurückgestellt – siehe
> [CHANGELOG](../../CHANGELOG.md) für die Gründe (Peer-Dependency-Konflikte
> im jeweiligen Ökosystem).

### Infrastruktur
| Technologie | Zweck |
|---|---|
| Docker Compose | Multi-Container Orchestrierung |
| Nginx | Frontend-Serving + API-Proxy |
| GitHub Actions | CI/CD Pipeline |
| Caddy (optional) | TLS-Terminierung/Reverse-Proxy, siehe `docker-compose.tls.yml` |

## 🏛️ Container-Architektur

```
┌──────────────────────────────────────────────────────────────────┐
│                  Docker Network (openfloorball_internal)            │
│                                                                    │
│  ┌────────────┐      ┌────────────┐      ┌────────────┐          │
│  │  Frontend  │ ───▶ │  Backend   │ ───▶ │ PostgreSQL │          │
│  │ Nginx :80  │      │ Node :3001 │      │  :5432     │          │
│  └────────────┘      └─────┬──────┘      └────────────┘          │
│    :${APP_PORT}             │                                    │
│    (Host-Port,              ▼                                    │
│     Standard 80)      ┌────────────┐                             │
│                       │   Redis    │                             │
│                       │   :6379    │                             │
│                       └────────────┘                             │
└──────────────────────────────────────────────────────────────────┘
```

Nur `frontend` bindet einen Host-Port (`APP_PORT`, Standard `80`); Backend,
Postgres und Redis sind ausschließlich intern über das Docker-Netzwerk
erreichbar, nicht direkt vom Host aus. Persistente Volumes: `db_data_pg18`
(Postgres-Daten), `redis_data`, `exports_data` (temporäre GIF/MP4/PDF-Dateien,
24h-Aufbewahrung), `backups_data` (automatische Admin-Backups).

## 🔄 Datenfluss: GIF-/MP4-Export

```
Coach klickt "Exportieren"
  ↓
Frontend rendert jeden Frame offscreen als PNG (Konva.js, kein DOM)
  ↓
PNGs als Base64 an Backend (POST /api/export/gif bzw. /api/export/mp4)
  ↓
Backend schreibt PNGs temporär nach /app/exports/<jobId>/
  ↓
FFmpeg kombiniert PNGs zu GIF/MP4 (asynchroner Job, Polling via
GET /api/export/status/:id)
  ↓
Download über GET /api/export/download/:id
  ↓
Stündlicher Cleanup-Job entfernt Exporte älter als 24h
```

PDF-Taktikblätter (`POST /api/export/pdf`) und Trainingsplan-PDFs laufen
synchron ohne Job-Store: die bereits vom Client gerenderten PNGs werden
direkt per `pdfkit` in ein PDF gelegt und gestreamt.

## 🗄️ Datenmodell (Kurzüberblick)

Alle Tabellen sind Postgres, Migration idempotent über
`backend/src/db/migrate.js` (läuft bei jedem Backend-Start erneut,
`CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`):

- `users`, `settings` – Konto & Präferenzen
- `boards`, `frames` – Kern-Taktikdaten (ein Board hat mehrere Frames
  für Animation)
- `board_versions` – automatische Snapshots bei jeder Frame-Änderung
  (max. 50/Board, älteste werden verdrängt), erlaubt Wiederherstellen
- `board_collaborators`, `board_invites` – Board-Sharing für
  registrierte bzw. noch nicht registrierte Personen (Issue #51 MVP)
- `board_videos` – Video-Integration (Datei liegt auf Disk, Metadaten/
  Zeichnen-Overlay/Trim/Marken hier in der DB)
- `comments` – Kommentare auf Boards und Trainingseinheiten
- `playbooks` – Board-Sammlungen (Issue #52)
- `formation_templates` – wiederverwendbare Aufstellungen (Issue #46)
- `training_sessions`, `training_session_items` – Trainingsplaner,
  referenziert Boards per Fremdschlüssel statt Kopie (Issue #45)
- `roster_players` – zentraler Team-Kader (Issue #53)
- `lines`, `line_players` – Lines als taktische Kader-Spieler-
  Kombinationen, `line_players` als Many-to-Many-Junction (ein Spieler
  kann in beliebig vielen Lines stehen, fachlicher Umbau)
- `games` – Live-Spielnotizen (Gegner/Datum), die Notizen selbst laufen
  über `comments` mit `resource_type='game'`
- `teams`, `team_members` – Mannschaften mit Rollenmodell
- `organizations`, `organization_members` – Vereine mit mehreren Teams
- `library_entries`, `library_entry_reports` – Community-Bibliothek
  (Snapshot-Kopien veröffentlichter Boards) und Meldungen dazu
- `exports` – Metadaten für Share-Links (Board- und Frame-Ebene,
  Ablaufzeit, Token)
- `app_config` – globale Singleton-Konfiguration (u. a. Backup-Zeitplan,
  KI-Anbieter-Konfiguration)

## 🔌 KI-Anbieter (optional)

Vier textbasierte Assistenten (siehe [KI-Assistenten](./KI-Assistenten.md))
sprechen über einen austauschbaren Adapter mit einem beliebigen,
OpenAI-kompatiblen `/v1/chat/completions`-Endpunkt (`app_config`-Tabelle
oder `AI_PROVIDER_*`-Env-Vars). Ohne Konfiguration sind die
zugehörigen Buttons im Frontend einfach nicht sichtbar – kein
Fehlerzustand, keine Pflicht-Abhängigkeit von einem bestimmten Anbieter.

## 🟢 Echtzeit-Zusammenarbeit

Ein eigener WebSocket-Server (nicht Teil der REST-API unter `/api`,
siehe `services/presenceServer.js`) überträgt Präsenz-Badges und
Live-Cursor-Positionen pro Board-"Raum". Authentifizierung über
denselben HttpOnly-Session-Cookie wie die REST-API. Bewusst **keine**
serverseitige Konfliktauflösung oder Persistenz – siehe
[Echtzeit-Zusammenarbeit](./Echtzeit-Zusammenarbeit.md).

## 📶 Offline-Modus (PWA)

Service Worker (Workbox via `vite-plugin-pwa`) cacht die App-Shell und
GET-Antworten auf `/api/boards*` etc. (`NetworkFirst`, explizit **nicht**
`/api/auth`, `/api/admin`, `/api/user/export` – Datensparsamkeit).
Schreibzugriffe (PUT/DELETE auf bestehende Ressourcen), die offline
fehlschlagen, landen in einer IndexedDB-Queue
(`frontend/src/utils/offlineQueue.js`) und werden beim `online`-Event
automatisch erneut gesendet (Last-Write-Wins pro Ressource). Neuanlage
(POST) wird bewusst nicht offline gepuffert.

## Weiterführend

- [Frontend-Struktur](./Frontend.md) – Seiten, Komponenten, Hooks, Stores
- [API-Dokumentation](./API.md) – vollständige Endpunkt-Referenz
- [Umgebungsvariablen](./Umgebungsvariablen.md)
