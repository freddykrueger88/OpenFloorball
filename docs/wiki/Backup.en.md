# 💾 Backup & Export

*[🇩🇪 Deutsch](Backup.md) | 🇬🇧 English*

## Manual export (any user)

Under `/settings` → Account: full data export as a ZIP
(`GET /api/user/export`) – contains boards (incl. frames), roster,
lines, formation templates, playbooks, and training plans as JSON.
The same export can be re-imported via `POST /api/user/import`;
roster players are matched by name+number+role (not by their old ID)
so that line assignments are restored correctly – boards reference
their playbook by name, training plan entries reference their board
by name+field type+creation time (the same matching used for board
duplicate detection). If a referenced resource is missing on
re-import (e.g. because only a partial export is being imported), the
affected assignment is silently skipped instead of throwing an error.
Team assignments are deliberately not included in the export (a
re-import can't establish a meaningful team assignment) – imported
entries are always personal.

## Automatic backups (admin)

Admin-only, configurable under "Backup schedule" (see
[Settings](./Einstellungen.en.md#admin-settings)):

| Option | Values |
|---|---|
| Schedule | daily (3 AM) or weekly (Sunday, 3 AM) |
| Retention | number of backup runs to keep (default 7) |

On every run, a ZIP with the same structure as the manual export is
generated for **every user** and stored at
`/app/backups/<ISO-timestamp>/<userId>.zip` (Docker volume
`backups_data`). Older timestamp directories beyond the configured
retention are deleted automatically (oldest first).

The "Run now" button triggers the same run immediately at any time
(e.g. before risky maintenance work), regardless of whether automatic
backups are enabled or what the schedule is – useful without having to
wait for the next scheduled run.

## Database backup (full, outside the app)

The automatic backups above save **user data as JSON**, not the full
relational Postgres schema. For a complete database backup (e.g.
before a major upgrade):

```bash
docker exec openfloorball_db pg_dump -U openfloorball -d openfloorball \
  -F custom -f /tmp/backup.dump
docker cp openfloorball_db:/tmp/backup.dump ./openfloorball-backup.dump
```

Restore with `pg_restore` into a fresh database – see the
[PostgreSQL documentation](https://www.postgresql.org/docs/current/app-pgrestore.html).
