# ⚙️ Umgebungsvariablen (.env)

*🇩🇪 Deutsch | [🇬🇧 English](Umgebungsvariablen.en.md)*

Vollständige Referenz. Quelle der Wahrheit ist immer
[`.env.example`](../../.env.example) im Repository-Root – diese Seite
fasst dieselben Variablen mit Erklärung zusammen.

```bash
cp .env.example .env
nano .env
```

## App

| Variable | Beschreibung | Standard |
|---|---|---|
| `APP_PORT` | Host-Port, unter dem das Frontend erreichbar ist | `80` |
| `NODE_ENV` | `development` \| `production` \| `test` | `production` |

## Datenbank (PostgreSQL)

| Variable | Beschreibung | Standard |
|---|---|---|
| `DB_NAME` | Datenbankname | `openfloorball` |
| `DB_USER` | Datenbank-Benutzer | `openfloorball` |
| `DB_PASSWORD` | **Ändern!** Min. 20 Zeichen empfohlen (`openssl rand -base64 32`) | – |

## Redis

| Variable | Beschreibung | Standard |
|---|---|---|
| `REDIS_PASSWORD` | **Ändern!** (`openssl rand -base64 32`) | – |

## JWT (Sessions)

| Variable | Beschreibung | Standard |
|---|---|---|
| `JWT_SECRET` | **Ändern!** Min. 64 Zeichen (`openssl rand -base64 64`). Server startet nicht ohne ausreichend langen Wert | – |
| `JWT_EXPIRES_IN` | Gültigkeitsdauer, z. B. `7d`, `24h`, `1h` | `7d` |

## CORS

| Variable | Beschreibung | Standard |
|---|---|---|
| `CORS_ORIGIN` | Erlaubte Frontend-Origin. Produktiv die tatsächliche Domain, z. B. `https://openfloorball.example.com` | `http://localhost:3000` |

## bcrypt

| Variable | Beschreibung | Standard |
|---|---|---|
| `BCRYPT_ROUNDS` | Hashing-Runden für Passwörter, min. 12 | `12` |

## Cookies

| Variable | Beschreibung | Standard |
|---|---|---|
| `COOKIE_SECURE` | Session-Cookie nur über HTTPS. `false` setzen, wenn **kein** TLS-Reverse-Proxy davorsteht (sonst verwirft der Browser das Login-Cookie) | `true` |

## Share-Links

| Variable | Beschreibung | Standard |
|---|---|---|
| `SHARE_LINK_EXPIRES_HOURS` | Ablaufzeit öffentlicher Board-Links | `72` |

## E-Mail (SMTP, optional)

Siehe ausführliche Anleitung: [E-Mail-Versand einrichten](./E-Mail-Versand.md).

| Variable | Beschreibung | Standard |
|---|---|---|
| `SMTP_HOST` | SMTP-Server-Adresse. Leer = kein Mailversand, App bleibt voll funktionsfähig | – |
| `SMTP_PORT` | SMTP-Port | `587` |
| `SMTP_SECURE` | `true` nur bei Port 465 (implizites TLS), sonst `false` (STARTTLS) | `false` |
| `SMTP_USER` | SMTP-Benutzername | – |
| `SMTP_PASSWORD` | SMTP-Passwort (bei Gmail: App-Passwort, nicht das Kontopasswort) | – |
| `SMTP_FROM` | Absenderadresse, Format `Name <email>` | – |

## Frontend Build

| Variable | Beschreibung | Standard |
|---|---|---|
| `VITE_API_URL` | API-Basis-URL fürs Frontend. Im Docker-Setup via Nginx-Proxy | `/api` |

## TLS-Overlay (optional, `docker-compose.tls.yml`)

Nur relevant, wenn Caddy als automatischer TLS-Reverse-Proxy genutzt
wird (siehe [Sicherheit](./Sicherheit.md)):

| Variable | Beschreibung |
|---|---|
| `DOMAIN` | Öffentliche Domain, für die Caddy automatisch ein Let's-Encrypt-Zertifikat bezieht |
