# 🩹 Troubleshooting

*[🇩🇪 Deutsch](Troubleshooting.md) | 🇬🇧 English*

## Login doesn't work / the cookie is dropped immediately

Usually `COOKIE_SECURE=true` (default) without HTTPS in front of it.
For plain HTTP use on a home network, set `COOKIE_SECURE=false` in
`.env` and restart (`docker compose up -d --build`).

## After `docker compose up -d --build` the app still looks old

Two possible causes:

1. **The service worker is caching the old version** – the PWA uses
   `autoUpdate`; a one-time hard reload (Ctrl+Shift+R) is usually
   enough to load the new version.
2. Only `git pull` was run, without a rebuild – `git pull` alone
   doesn't update the running containers. Always rebuild and restart
   with `docker compose up -d --build`.

## Container doesn't start / "port already in use"

Another service is already using port 80 (or the port configured in
`APP_PORT`). Either stop the other service or change `APP_PORT` in
`.env` to a free port.

## Postgres container stuck in a restart loop after a major upgrade

Postgres images ≥ 18 expect a data volume at `/var/lib/postgresql`
(the parent directory), no longer `/var/lib/postgresql/data` as with
older versions. When manually switching the Postgres major image:
check the volume mount in `docker-compose.yml` and, if needed, migrate
via `pg_dump`/`pg_restore` into a newly mounted volume (see
[Backup](./Backup.en.md)).

## Email sending doesn't work

See the dedicated guide: [Setting up email
delivery](./E-Mail-Versand.en.md) (the "Testing" section).

## The backup directory keeps growing without limit

Check whether a sensible retention value (`retention`) is configured
under Admin Settings – see [Backup](./Backup.en.md). The default is 7
runs.

## "JWT_SECRET is missing or shorter than 32 characters" on startup

`JWT_SECRET` in `.env` must be set and sufficiently long (recommended:
64 characters, `openssl rand -base64 64`). The server deliberately
refuses to start without a sufficiently strong value.

## Viewing logs

```bash
docker compose logs -f backend
docker compose logs -f frontend
```

## Further reading

- [FAQ](./FAQ.en.md)
- [Environment variables](./Umgebungsvariablen.en.md)
- Report a bug: [Issue templates](https://github.com/freddykrueger88/OpenFloorball/issues/new/choose)
