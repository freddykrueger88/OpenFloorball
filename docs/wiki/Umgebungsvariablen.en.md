# ⚙️ Environment variables (.env)

*[🇩🇪 Deutsch](Umgebungsvariablen.md) | 🇬🇧 English*

Full reference. The source of truth is always
[`.env.example`](../../.env.example) in the repository root – this
page summarizes the same variables with explanations.

```bash
cp .env.example .env
nano .env
```

## App

| Variable | Description | Default |
|---|---|---|
| `APP_PORT` | Host port the frontend is reachable on | `80` |
| `NODE_ENV` | `development` \| `production` \| `test` | `production` |

## Database (PostgreSQL)

| Variable | Description | Default |
|---|---|---|
| `DB_NAME` | Database name | `openfloorball` |
| `DB_USER` | Database user | `openfloorball` |
| `DB_PASSWORD` | **Change this!** Min. 20 characters recommended (`openssl rand -base64 32`) | – |

## Redis

| Variable | Description | Default |
|---|---|---|
| `REDIS_PASSWORD` | **Change this!** (`openssl rand -base64 32`) | – |

## JWT (sessions)

| Variable | Description | Default |
|---|---|---|
| `JWT_SECRET` | **Change this!** Min. 64 characters (`openssl rand -base64 64`). The server won't start without a sufficiently long value | – |
| `JWT_EXPIRES_IN` | Validity period, e.g. `7d`, `24h`, `1h` | `7d` |

## CORS

| Variable | Description | Default |
|---|---|---|
| `CORS_ORIGIN` | Allowed frontend origin. In production, the actual domain, e.g. `https://openfloorball.example.com` | `http://localhost:3000` |

## bcrypt

| Variable | Description | Default |
|---|---|---|
| `BCRYPT_ROUNDS` | Hashing rounds for passwords, min. 12 | `12` |

## Cookies

| Variable | Description | Default |
|---|---|---|
| `COOKIE_SECURE` | Session cookie over HTTPS only. Set to `false` if there's **no** TLS reverse proxy in front (otherwise the browser rejects the login cookie) | `true` |

## Reverse proxy

| Variable | Description | Default |
|---|---|---|
| `TRUST_PROXY` | Number of trusted proxy hops for Express `trust proxy`: `1` = bundled Nginx, `2` = additional host Nginx/Traefik, `false`/`0` = no proxy, or CIDR/IP (e.g. `loopback`, `10.0.0.0/8`) | `1` |

## Registration & first admin

| Variable | Description | Default |
|---|---|---|
| `REGISTRATION_MODE` | `open` \| `invite` (code required) \| `approval` (admin must approve) \| `closed` (no registration) | `open` |
| `REGISTRATION_INVITE_CODE` | Shared invite code for `invite`. Long random value, e.g. `openssl rand -hex 24`. Invite link: `https://domain/register?invite=<CODE>` | – |
| `BOOTSTRAP_ADMIN_EMAIL` | First admin in production. Only created while no user exists | – |
| `BOOTSTRAP_ADMIN_PASSWORD` | Password for the bootstrap admin (min. 8 chars, upper/lowercase + digit). Never overwritten later | – |

> **Important:** In production, a random first registrant no longer becomes
> admin. Without an active admin, registration stays locked (HTTP 503) until
> `BOOTSTRAP_ADMIN_EMAIL`/`BOOTSTRAP_ADMIN_PASSWORD` are set and the server
> is restarted.

## JSON & import limits

| Variable | Description | Default |
|---|---|---|
| `BOARD_JSON_LIMIT` | Max. size of a board/frame save. Parsing happens only after login; all other JSON endpoints stay at 10 KB | `4mb` |
| `MAX_IMPORT_UNCOMPRESSED_MB` | Max. uncompressed size of `backup.json` during ZIP import (zip-bomb protection) | `25` |

## Share links

| Variable | Description | Default |
|---|---|---|
| `SHARE_LINK_EXPIRES_HOURS` | Expiry time for public board links | `72` |

## Email (SMTP, optional)

See the detailed guide: [Setting up email delivery](./E-Mail-Versand.en.md).

| Variable | Description | Default |
|---|---|---|
| `SMTP_HOST` | SMTP server address. Empty = no email sending, the app stays fully functional | – |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_SECURE` | `true` only for port 465 (implicit TLS), otherwise `false` (STARTTLS) | `false` |
| `SMTP_USER` | SMTP username | – |
| `SMTP_PASSWORD` | SMTP password (for Gmail: an app password, not your account password) | – |
| `SMTP_FROM` | Sender address, format `Name <email>` | – |

## Frontend build

| Variable | Description | Default |
|---|---|---|
| `VITE_API_URL` | API base URL for the frontend. In the Docker setup, via the Nginx proxy | `/api` |

## TLS overlay (optional, `docker-compose.tls.yml`)

Only relevant if Caddy is used as an automatic TLS reverse proxy (see
[Security](./Sicherheit.en.md)):

| Variable | Description |
|---|---|
| `DOMAIN` | Public domain for which Caddy automatically obtains a Let's Encrypt certificate |
