# ❓ FAQ

*[🇩🇪 Deutsch](FAQ.md) | 🇬🇧 English*

**Does OpenFloorball run without Docker?**
Not officially supported – the project is deliberately built Docker
first (backend, frontend/Nginx, Postgres, Redis as separate
containers). For local development, see
[Manual installation](./Installation-Entwicklung.en.md).

**Do I need HTTPS?**
Not required for pure home network/LAN use (set `COOKIE_SECURE=false`).
For access over the open internet: yes – see [Security](./Sicherheit.en.md).

**Can multiple coaches work on one board at the same time?**
Boards can be shared (read/write access, see
[Export & sharing](./Export.en.md)). True simultaneous editing with
live cursors is deliberately (still) not part of the feature set, see
[ROADMAP](./Roadmap.en.md).

**Why do I get an error "No user found with this email address" when
sharing a board?**
Board sharing requires an already **registered** OpenFloorball account
– there's (still) no invite link for new, unregistered email
addresses. The invited person has to register themselves at
`/register` first.

**Does OpenFloorball send emails?**
Only optionally, and only a short notification when added as a
collaborator – see [Setting up email delivery](./E-Mail-Versand.en.md).
Without a configured SMTP server, nothing happens; the app stays fully
functional.

**Is OpenFloorball optimized for tablets/smartphones?**
Not dedicatedly – desktop/laptop is the primary use case, the layout
isn't specifically tested for touch gestures.

**Is OpenFloorball accessible?**
The app follows WCAG 2.1 AA / BITV 2.0 / EN 301 549 throughout
(keyboard operability, ARIA labels, screen reader announcements), but
hasn't been externally certified so far.

**Does OpenFloorball work offline?**
Partially – the app shell and most recently loaded board data are
cached via a service worker (PWA). Write operations during an offline
period are buffered and synced automatically once a connection is
available again. Details:
[Architecture – offline mode](./Architektur.en.md#offline-mode-pwa).

**How do I update to a new version?**
```bash
git pull
docker compose up -d --build
```
Database migrations run automatically on backend startup.

**Where do I find all the changes in a new version?**
[Changelog](./Changelog.en.md).
