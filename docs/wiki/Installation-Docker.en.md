# 🚀 Quick Start with Docker

*[🇩🇪 Deutsch](Installation-Docker.md) | 🇬🇧 English*

## Requirements

- Docker 24+ and Docker Compose v2
- Git
- At least 2GB RAM, 5GB free disk space

## Installation

```bash
# 1. Clone the repository
git clone https://github.com/freddykrueger88/OpenFloorball.git
cd OpenFloorball

# 2. Configure environment variables
cp .env.example .env
nano .env   # Set JWT_SECRET, DB password AND the bootstrap admin!

# 3. Start containers
docker compose up -d

# 4. Check status
docker compose ps
docker compose logs -f
```

## Reachability

- **Frontend:** http://localhost:${APP_PORT} (default: `80`, see `.env`
  – so with the default value, just `http://localhost`)
- **Backend API:** only reachable internally via the Nginx proxy, at
  `http://localhost:${APP_PORT}/api/` — the backend port itself isn't
  mapped to the host
- **Health check:** http://localhost:${APP_PORT}/health

## First launch

1. Before the first start, set in `.env`:
   ```bash
   BOOTSTRAP_ADMIN_EMAIL=admin@example.com
   BOOTSTRAP_ADMIN_PASSWORD=<strong password>
   ```
   The admin is only created while no user exists. In production, a random
   first registrant no longer becomes admin.
2. Open `http://localhost` (or `http://localhost:${APP_PORT}` if you
   changed it) and log in with the bootstrap admin.
3. Create your first field and start coaching!
4. Optional: use `REGISTRATION_MODE` to decide whether others may register
   openly (`open`), only with an invite code (`invite`), only after approval
   (`approval`), or not at all (`closed`).

> Without an active admin, registration stays locked (HTTP 503) until
> `BOOTSTRAP_ADMIN_EMAIL`/`BOOTSTRAP_ADMIN_PASSWORD` are set and the server
> is restarted.

## Updates

```bash
git pull
docker compose up -d --build
```

## Important .env settings

| Variable | Description | Default |
|---|---|---|
| `APP_PORT` | Frontend port | 80 |
| `JWT_SECRET` | **Change this!** At least 64 characters | - |
| `DB_PASSWORD` | **Change this!** Strong password | - |
| `REDIS_PASSWORD` | **Change this!** Strong password | - |
| `TRUST_PROXY` | Number of trusted proxy hops (`1` = bundled Nginx, `2` = additional host proxy, `false` = none) | `1` |
| `REGISTRATION_MODE` | `open`, `invite`, `approval` or `closed` | `open` |
| `BOOTSTRAP_ADMIN_EMAIL` | First admin, created only while no user exists | - |
| `BOOTSTRAP_ADMIN_PASSWORD` | Password for the bootstrap admin | - |
| `COOKIE_SECURE` | Only send the session cookie over HTTPS. Set to `false` if there's no TLS reverse proxy in front (otherwise the login cookie gets rejected) | `true` |

> ⚠️ **Security:** Make sure to change `JWT_SECRET` and `DB_PASSWORD` before the first start!

## Further reading

- [All environment variables](./Umgebungsvariablen.en.md)
- [Getting started in the app](./Erste-Schritte.en.md)
- [Setting up email delivery](./E-Mail-Versand.en.md) (optional)
- [Security notes](./Sicherheit.en.md), incl. TLS via Caddy
