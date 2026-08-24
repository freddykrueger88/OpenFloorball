# 🎨 Frontend Structure

*[🇩🇪 Deutsch](Frontend.md) | 🇬🇧 English*

React 19 + Vite, no central Redux – server state via custom hooks per
resource, client state via lightweight Zustand stores.

```
frontend/src/
├── pages/          One file per route (React Router)
├── components/      Grouped by domain (see below)
├── hooks/           One hook per backend resource + UI behavior
├── store/           Zustand stores (global client state)
├── constants/        Static configuration (field dimensions, colors, tools)
├── i18n/locales/     de.json / en.json
└── utils/            API client, formatting, offline queue
```

## Pages (`pages/`)

| Route | File |
|---|---|
| `/boards` | `BoardsPage.jsx` |
| `/board/:id` | `BoardEditorPage.jsx` |
| `/trainings` | `TrainingsPage.jsx` |
| `/trainings/:id` | `TrainingSessionPage.jsx` |
| `/roster` | `RosterPage.jsx` |
| `/lines` | `LinesPage.jsx` |
| `/games` | `GamesPage.jsx` |
| `/games/:id` | `GamePage.jsx` |
| `/settings` | `SettingsPage.jsx` |
| `/share/:token` | `SharePage.jsx` (public, no login) |
| `/privacy` | `PrivacyPage.jsx` |
| `/rules` | `RulesPage.jsx` |
| `/login`, `/register` | `LoginPage.jsx`, `RegisterPage.jsx` |

All pages are `lazy()`-loaded (code splitting per route).

## Components (`components/`)

| Folder | Contents |
|---|---|
| `field/` | Field rendering (Konva), player tokens, field settings |
| `drawing/` | Drawing tools, coordinate form |
| `frames/` | Frame timeline |
| `playback/` | Play/pause/speed/loop controls |
| `formations/` | Formations panel |
| `games/` | Game tile (`GameCard`) for the games overview |
| `board/` | Notes, export panels, collaborators modal, tab menu (`BoardSidePanelTabs`) |
| `boards/` | Boards overview (tiles, postcard gallery, playbook filter) |
| `trainings/` | Training planner UI |
| `layout/` | Header, skip links |
| `a11y/` | Accessibility helper components |
| `settings/` | Settings UI building blocks |

## Key hooks (`hooks/`)

One hook per backend resource typically encapsulates: load, create,
update, delete, plus local state.

| Hook | Responsible for |
|---|---|
| `useBoardsApi` | Boards CRUD |
| `useFrames` | Frames + active frame |
| `useDrawing` | Drawing tools, undo/redo, keyboard shortcuts |
| `useFormations`, `usePlaybooks` | Respective backend module |
| `useRoster` | Roster |
| `useLines` | Lines (roster-player combinations, not tied to a board) |
| `useGames` | Games (live game notes run via `useComments('games', id)`) |
| `useTrainingSessions`, `useTrainingSessionItems` | Training planner |
| `useBoardCollaborators` | Board sharing |
| `useAutoSave` | Debounced + interval-based saving, status display |
| `useAnimation` | Frame playback, interpolation, keyboard shortcuts |
| `useExport`, `usePdfExport` | GIF/MP4/PDF export incl. job polling |
| `useShare` | Public share links |
| `useSettings` | Account settings |
| `useBackup` | Admin backup configuration |
| `useField` | Field type, grid, zoom |

## Stores (`store/`)

| Store | Purpose |
|---|---|
| `authStore` | Logged-in user |
| `themeStore` | Active theme (dark/light/vikings/iff) |
| `announceStore` | ARIA live announcements for screen readers |
| `offlineStore` | Online/offline status, queue for PWA (see [Architecture](./Architektur.en.md#offline-mode-pwa)) |

## Internationalization

`i18next` + `react-i18next`, two languages (`de`, `en`) as flat JSON
files under `i18n/locales/`. Language selection in
[Settings](./Einstellungen.en.md).
