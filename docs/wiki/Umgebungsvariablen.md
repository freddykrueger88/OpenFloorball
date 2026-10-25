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

## Reverse Proxy

| Variable | Beschreibung | Standard |
|---|---|---|
| `TRUST_PROXY` | Anzahl vertrauenswürdiger Proxy-Hops für Express `trust proxy`: `1` = gebündelter Nginx, `2` = zusätzlich Host-Nginx/Traefik, `false`/`0` = kein Proxy, oder CIDR/IP (z. B. `loopback`, `10.0.0.0/8`) | `1` |

## Registrierung & erster Admin

| Variable | Beschreibung | Standard |
|---|---|---|
| `REGISTRATION_MODE` | `open` (offen) \| `invite` (nur mit Code) \| `approval` (Admin muss freigeben) \| `closed` (keine Registrierung) | `open` |
| `REGISTRATION_INVITE_CODE` | Gemeinsamer Einladungscode für `invite`. Langer Zufallswert, z. B. `openssl rand -hex 24`. Einladungslink: `https://domain/register?invite=<CODE>` | – |
| `BOOTSTRAP_ADMIN_EMAIL` | Erster Admin in Produktion. Wird nur angelegt, solange noch kein User existiert | – |
| `BOOTSTRAP_ADMIN_PASSWORD` | Passwort zum Bootstrap-Admin (min. 8 Zeichen, Groß-/Kleinbuchstaben + Zahl). Wird nie nachträglich überschrieben | – |

> **Wichtig:** In Produktion wird kein zufälliger Erst-Registrant mehr Admin.
> Ohne aktiven Admin bleibt die Registrierung gesperrt (HTTP 503), bis
> `BOOTSTRAP_ADMIN_EMAIL`/`BOOTSTRAP_ADMIN_PASSWORD` gesetzt und der Server
> neu gestartet wurde.

## JSON- & Import-Limits

| Variable | Beschreibung | Standard |
|---|---|---|
| `BOARD_JSON_LIMIT` | Max. Größe eines Board-/Frame-Saves. Der Parser läuft erst nach dem Login; alle anderen JSON-Endpunkte bleiben bei 10 KB | `4mb` |
| `MAX_IMPORT_UNCOMPRESSED_MB` | Max. entpackte Größe von `backup.json` beim ZIP-Import (Schutz vor ZIP-Bomben) | `25` |

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
