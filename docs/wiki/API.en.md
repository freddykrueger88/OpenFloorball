# 🔌 API Documentation

*[🇩🇪 Deutsch](API.md) | 🇬🇧 English*

REST API under `/api`. Authentication via an HttpOnly session cookie
(JWT), set by `POST /api/auth/login` or `/register`. There's no
separate API token system — the API is meant for the app's own
frontend, not as a public third-party interface.

All responses follow the schema `{ success: boolean, data?, message?
}`. Invalid input returns `422` with validation details
(express-validator); missing permission returns `401`/`404`
(deliberately `404` instead of `403` for resources you don't own, so
as not to reveal whether a resource ID even exists).

## Auth

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/register` | Register (first user = admin) |
| POST | `/api/auth/login` | Log in |
| POST | `/api/auth/logout` | Log out (auth.) |
| GET | `/api/auth/me` | Own profile (auth.) |
| PUT | `/api/auth/name` | Change name (auth.) |
| PUT | `/api/auth/email` | Change email (auth.) |
| PUT | `/api/auth/password` | Change password (auth.) |
| POST | `/api/auth/forgot-password` | Request a reset link by email (public, always a generic response – no enumeration) |
| POST | `/api/auth/reset-password` | Set a new password using a token (public, token is single-use, valid for 1h) |

## Boards

| Method | Path | Description |
|---|---|---|
| GET | `/api/boards` | Own + shared boards |
| GET | `/api/boards/:id` | A single board |
| POST | `/api/boards` | Create a board |
| PUT | `/api/boards/:id` | Update a board |
| DELETE | `/api/boards/:id` | Delete a board (owner-only) |
| POST | `/api/boards/:id/share` | Generate a public share link |

## Frames

| Method | Path | Description |
|---|---|---|
| GET | `/api/boards/:id/frames` | Frames of a board |
| POST | `/api/boards/:id/frames` | Create a frame |
| PUT | `/api/boards/:id/frames/reorder` | Change order |
| PUT | `/api/boards/:id/frames/:frameId` | Update a frame |
| DELETE | `/api/boards/:id/frames/:frameId` | Delete a frame |

## Board collaborators

| Method | Path | Description |
|---|---|---|
| GET | `/api/boards/:id/collaborators` | List (owner-only) |
| POST | `/api/boards/:id/collaborators` | Add by email, max. 10/board (owner-only) |
| PUT | `/api/boards/:id/collaborators/:collaboratorId` | Change permission (owner-only) |
| DELETE | `/api/boards/:id/collaborators/:collaboratorId` | Remove (owner-only) |
| GET | `/api/invite/:token` | View a pending invite (public, no auth) |

## Board versions

| Method | Path | Description |
|---|---|---|
| GET | `/api/boards/:id/versions` | List of all snapshots (max. 50/board) |
| GET | `/api/boards/:id/versions/:versionId` | Full snapshot |
| POST | `/api/boards/:id/versions/:versionId/restore` | Restore (backs up the current state first) |

## Video

| Method | Path | Description |
|---|---|---|
| GET | `/api/boards/:id/videos` | List (max. 5/board) |
| POST | `/api/boards/:id/videos` | Upload (MP4/WebM/MOV, max. 200 MB) |
| GET | `/api/boards/:id/videos/:videoId/stream` | Playback (range requests) |
| PUT | `/api/boards/:id/videos/:videoId` | Update (drawing overlay, trim, markers) |
| DELETE | `/api/boards/:id/videos/:videoId` | Delete |

## Comments

Mounted on two resources with an identical structure:
`/api/boards/:id/comments` and `/api/trainings/:id/comments`.

| Method | Path | Description |
|---|---|---|
| GET | `.../comments` | List |
| POST | `.../comments` | Create (max. 500/resource) |
| PUT | `.../comments/:commentId` | Update (author only) |
| DELETE | `.../comments/:commentId` | Delete (author, or anyone with write access to the resource) |

## Export

| Method | Path | Description |
|---|---|---|
| POST | `/api/export/gif` | Start a GIF export (async) |
| POST | `/api/export/mp4` | Start an MP4 export (async) |
| POST | `/api/export/pdf` | PDF export (synchronous) |
| GET | `/api/export/status/:id` | Check job status |
| GET | `/api/export/download/:id` | Download the finished file |

## Public share view

| Method | Path | Description |
|---|---|---|
| GET | `/api/share/:token` | Read a board without logging in (deliberately **not** behind auth) |
| POST | `/api/export/frame-share` | Generate a single frame as a PNG share link (max. 5 MB) |
| GET | `/api/share/frame/:token` | View a frame share image (public) |

## Settings

| Method | Path | Description |
|---|---|---|
| GET | `/api/settings` | Own settings |
| PUT | `/api/settings` | Partial update (merge) |

## User

| Method | Path | Description |
|---|---|---|
| DELETE | `/api/user/account` | Delete account |
| GET | `/api/user/data` | Own account data |
| GET | `/api/user/export` | Full data export (GDPR) |
| POST | `/api/user/import` | Data import |

## Admin

Admin role only.

| Method | Path | Description |
|---|---|---|
| GET | `/api/admin/users` | All users |
| DELETE | `/api/admin/users/:id` | Delete a user |
| PUT | `/api/admin/users/:id/role` | Change role |
| GET | `/api/admin/backup-config` | Read backup schedule |
| PUT | `/api/admin/backup-config` | Change backup schedule |
| POST | `/api/admin/backup-run` | Run a backup immediately (independent of the schedule) |
| GET | `/api/admin/library-reports` | Reported library entries |
| GET | `/api/admin/ai-config` | Read AI provider configuration (API key only shown as "set/not set") |
| PUT | `/api/admin/ai-config` | Change AI provider configuration |

## Formations

| Method | Path | Description |
|---|---|---|
| GET | `/api/formations` | Own templates |
| POST | `/api/formations` | Save a template (max. 20) |
| DELETE | `/api/formations/:id` | Delete a template |

## Playbooks

| Method | Path | Description |
|---|---|---|
| GET | `/api/playbooks` | Own playbooks |
| POST | `/api/playbooks` | Create a playbook (max. 15) |
| DELETE | `/api/playbooks/:id` | Delete a playbook |

## Training plans

| Method | Path | Description |
|---|---|---|
| GET | `/api/trainings` | Own training plans |
| POST | `/api/trainings` | Create a training plan |
| GET | `/api/trainings/:id` | A single training plan (incl. items) |
| PUT | `/api/trainings/:id` | Update a training plan |
| DELETE | `/api/trainings/:id` | Delete a training plan |
| POST | `/api/trainings/:id/items` | Add a drill (board reference) |
| PUT | `/api/trainings/:id/items/reorder` | Change order |
| PUT | `/api/trainings/:id/items/:itemId` | Update a drill |
| DELETE | `/api/trainings/:id/items/:itemId` | Remove a drill |

## Roster

| Method | Path | Description |
|---|---|---|
| GET | `/api/roster` | Own roster (+ team-shared entries) |
| POST | `/api/roster` | Create a player (max. 40, optional teamId) |
| GET | `/api/roster/:id` | A single roster player |
| PUT | `/api/roster/:id` | Update a player |
| DELETE | `/api/roster/:id` | Delete a player (also cleans up their line assignments) |

## Lines

Bound to user/team like roster/games, **not** bound to a board. A
roster player can be in any number of lines (many-to-many via the
internal `line_players` table) – see [Lines](./Lines.en.md).

| Method | Path | Description |
|---|---|---|
| GET | `/api/lines` | Own lines (+ team-shared) |
| POST | `/api/lines` | Create a line (max. 20) |
| PUT | `/api/lines/:id` | Update a line (name/color/type) |
| DELETE | `/api/lines/:id` | Delete a line (players stay in the roster) |
| POST | `/api/lines/:id/players` | Add a roster player to the line |
| DELETE | `/api/lines/:id/players/:rosterPlayerId` | Remove a player from the line |
| PUT | `/api/lines/:id/active` | Activate/deactivate (deactivates other lines in the same group) |

## Games (live game notes)

Bound to user/team, not bound to a board. The notes themselves run
through the comment infrastructure (`resource_type='game'`) – see
[Live game notes](./Live-Spielnotizen.en.md).

| Method | Path | Description |
|---|---|---|
| GET | `/api/games` | Own games (+ team-shared) |
| POST | `/api/games` | Create a game (max. 30) |
| GET | `/api/games/:id` | A single game |
| PUT | `/api/games/:id` | Update a game (opponent/date/notes) |
| DELETE | `/api/games/:id` | Delete a game (also cleans up its notes) |
| GET | `/api/games/:id/comments` | Live notes for the game |
| POST | `/api/games/:id/comments` | Add a note (read access is enough) |
| DELETE | `/api/games/:id/comments/:commentId` | Delete a note (author or write access) |

## Teams

| Method | Path | Description |
|---|---|---|
| GET | `/api/teams` | Own teams |
| POST | `/api/teams` | Create a team |
| GET | `/api/teams/:id` | A single team |
| PUT | `/api/teams/:id` | Update a team (owner/coach) |
| DELETE | `/api/teams/:id` | Delete a team (owner) |
| GET | `/api/teams/:id/members` | Member list |
| POST | `/api/teams/:id/members` | Invite a member (existing account required) |
| PUT | `/api/teams/:id/members/:memberId` | Change role |
| DELETE | `/api/teams/:id/members/:memberId` | Remove a member |

## Organizations (clubs)

| Method | Path | Description |
|---|---|---|
| GET | `/api/organizations` | Own organizations |
| POST | `/api/organizations` | Create an organization |
| GET | `/api/organizations/:id` | A single organization |
| PUT | `/api/organizations/:id` | Update an organization (admin) |
| DELETE | `/api/organizations/:id` | Delete an organization (admin) |
| GET | `/api/organizations/:id/members` | Member list |
| POST | `/api/organizations/:id/members` | Invite a member |
| PUT | `/api/organizations/:id/members/:memberId` | Change role |
| DELETE | `/api/organizations/:id/members/:memberId` | Remove a member |

## Community library

| Method | Path | Description |
|---|---|---|
| GET | `/api/library` | Browse (category filter, text search, paginated) |
| GET | `/api/library/:id` | A single entry |
| POST | `/api/boards/:id/publish` | Publish a board as a snapshot (owner-only) |
| POST | `/api/library/:id/clone` | Adopt as your own board |
| POST | `/api/library/:id/report` | Report an entry |
| DELETE | `/api/library/:id` | Delete (creator or admin) |

## AI assistants

Only visible/usable when an AI provider is configured (see
[AI assistants](./KI-Assistenten.en.md)). They only ever produce text
drafts, no auto-save.

| Method | Path | Description |
|---|---|---|
| GET | `/api/ai/status` | Whether/which AI provider is configured |
| POST | `/api/ai/training-plan` | Training assistant |
| POST | `/api/ai/tactic-suggestion` | Tactics assistant |
| POST | `/api/ai/analysis` | Analysis assistant |
| POST | `/api/ai/knowledge-query` | Knowledge assistant (only answers if it finds matches in your own data) |

## Error codes

| Code | Meaning |
|---|---|
| `400` | Invalid request (e.g. limit reached, self-reference) |
| `401` | Not authenticated |
| `404` | Resource not found **or** no access |
| `422` | Validation error (express-validator) |
| `500` | Internal server error |
