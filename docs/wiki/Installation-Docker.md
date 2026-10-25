# 🚀 Schnellstart mit Docker

*🇩🇪 Deutsch | [🇬🇧 English](Installation-Docker.en.md)*

## Voraussetzungen

- Docker 24+ und Docker Compose v2
- Git
- Mind. 2GB RAM, 5GB freier Speicher

## Installation

```bash
# 1. Repository klonen
git clone https://github.com/freddykrueger88/OpenFloorball.git
cd OpenFloorball

# 2. Umgebungsvariablen konfigurieren
cp .env.example .env
nano .env   # JWT_SECRET, DB-Passwort UND Bootstrap-Admin setzen!

# 3. Container starten
docker compose up -d

# 4. Status prüfen
docker compose ps
docker compose logs -f
```

## Erreichbarkeit

- **Frontend:** http://localhost:${APP_PORT} (Standard: `80`, siehe `.env` –
  bei Standardwert also einfach `http://localhost`)
- **Backend API:** nur intern über den Nginx-Proxy erreichbar, unter `http://localhost:${APP_PORT}/api/` — der Backend-Port selbst ist nicht auf den Host gemappt
- **Health Check:** http://localhost:${APP_PORT}/health

## Erster Start

1. Setze vor dem ersten Start in `.env`:
   ```bash
   BOOTSTRAP_ADMIN_EMAIL=admin@example.com
   BOOTSTRAP_ADMIN_PASSWORD=<starkes Passwort>
   ```
   Der Admin wird beim Start nur angelegt, solange noch kein Benutzer
   existiert. In Produktion wird **kein** zufälliger Erst-Registrant mehr
   Admin.
2. Öffne `http://localhost` (bzw. `http://localhost:${APP_PORT}`, falls
   angepasst) und melde dich mit dem Bootstrap-Admin an.
3. Lege dein erstes Spielfeld an und beginne mit dem Coachen!
4. Optional: Lege unter `REGISTRATION_MODE` fest, ob sich weitere Personen
   offen (`open`), nur mit Einladungscode (`invite`), erst nach Freigabe
   (`approval`) oder gar nicht (`closed`) registrieren dürfen.

> Ohne aktiven Admin bleibt die Registrierung gesperrt (HTTP 503), bis
> `BOOTSTRAP_ADMIN_EMAIL`/`BOOTSTRAP_ADMIN_PASSWORD` gesetzt und der Server
> neu gestartet wurde.

## Updates

```bash
git pull
docker compose up -d --build
```

## Wichtige .env Einstellungen

| Variable | Beschreibung | Standard |
|---|---|---|
| `APP_PORT` | Frontend-Port | 80 |
| `JWT_SECRET` | **Ändern!** Mind. 64 Zeichen | - |
| `DB_PASSWORD` | **Ändern!** Sicheres Passwort | - |
| `REDIS_PASSWORD` | **Ändern!** Sicheres Passwort | - |
| `TRUST_PROXY` | Anzahl vertrauenswürdiger Proxy-Hops (`1` = gebündelter Nginx, `2` = zusätzlicher Host-Proxy, `false` = keiner) | `1` |
| `REGISTRATION_MODE` | `open`, `invite`, `approval` oder `closed` | `open` |
| `BOOTSTRAP_ADMIN_EMAIL` | Erster Admin, wird nur angelegt, solange kein User existiert | - |
| `BOOTSTRAP_ADMIN_PASSWORD` | Passwort des Bootstrap-Admins | - |
| `COOKIE_SECURE` | Session-Cookie nur über HTTPS senden. `false` setzen, wenn kein TLS-Reverse-Proxy davorsteht (sonst wird das Login-Cookie verworfen) | `true` |

> ⚠️ **Sicherheit:** Ändere `JWT_SECRET` und `DB_PASSWORD` unbedingt vor dem ersten Start!

## Weiterführend

- [Alle Umgebungsvariablen](./Umgebungsvariablen.md)
- [Erste Schritte in der App](./Erste-Schritte.md)
- [E-Mail-Versand einrichten](./E-Mail-Versand.md) (optional)
- [Sicherheitshinweise](./Sicherheit.md), inkl. TLS via Caddy
