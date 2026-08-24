# 📶 Offline Mode (PWA)

*[🇩🇪 Deutsch](Offline-Modus.md) | 🇬🇧 English*

OpenFloorball is an installable Progressive Web App (service worker
via `vite-plugin-pwa`) and works to a limited extent even without an
internet connection – e.g. in a sports hall with poor Wi-Fi.

## What works offline

- The app interface itself (app shell) loads even offline.
- Previously loaded data (e.g. `GET /api/boards`) stays visible for a
  while via a `NetworkFirst` cache.
- **Deliberately excluded** from the cache: `/api/auth`, `/api/admin`,
  `/api/user/export` – for data minimization, sensitive responses
  aren't cached on the device.

## Saving changes offline

If you change or delete an existing resource (PUT/DELETE) without a
connection, the change goes into a local queue (IndexedDB) and is sent
automatically once the connection comes back. **New creations (POST)
are deliberately not buffered** – so creating a new board offline
doesn't work.

## Conflict detection

For the following resources, reconnecting checks whether someone else
(e.g. an assistant coach) has already changed the same resource in the
meantime:

- Boards and frames
- Training sessions
- Roster entries

If a conflict is detected, a notice dialog appears – the change is
**not** automatically overwritten or merged, the coach decides
manually whether and how to reapply the change. For all other
resources (e.g. playbooks, formations), "last change wins" still
applies on reconnect, without a warning.

## Related pages

- [Real-time collaboration](./Echtzeit-Zusammenarbeit.en.md)
- [Architecture](./Architektur.en.md)
