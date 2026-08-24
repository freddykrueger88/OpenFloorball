# 🔒 Sicherheitshinweise

*🇩🇪 Deutsch | [🇬🇧 English](Sicherheit.en.md)*

Die vollständige Security Policy liegt im Repository:

👉 **[SECURITY.md](../../SECURITY.md)**

Kurzfassung der wichtigsten Design-Entscheidungen:

- Passwörter mit `bcrypt` gehasht (min. 12 Runden), nie im Klartext
  gespeichert oder geloggt
- Sessions über HttpOnly-Cookies + JWT, Redis-Blacklist für
  ausgeloggte/gelöschte Accounts
- `JWT_SECRET` wird beim Serverstart auf Mindestlänge geprüft – zu
  kurzer/fehlender Wert verhindert den Start
- `COOKIE_SECURE=true` als Standard (HTTPS-only), für reinen
  Heimnetz-Betrieb ohne TLS bewusst deaktivierbar (siehe
  [Umgebungsvariablen](./Umgebungsvariablen.md))
- Wöchentlicher `npm audit` + `dependency-review-action` auf jedem PR

## Sicherheitslücke melden

**Nicht** als öffentliches GitHub-Issue. Über den Security-Tab des
Repositories:
[github.com/freddykrueger88/OpenFloorball/security/advisories/new](https://github.com/freddykrueger88/OpenFloorball/security/advisories/new).

## TLS/HTTPS für den eigenen Betrieb

Für Instanzen mit eigener Domain steht ein optionales Caddy-Overlay
(`docker-compose.tls.yml`) bereit, das automatisch ein
Let's-Encrypt-Zertifikat bezieht:

```bash
DOMAIN=openfloorball.example.com docker compose \
  -f docker-compose.yml -f docker-compose.tls.yml up -d
```

Ohne TLS-Reverse-Proxy im reinen Heimnetz muss `COOKIE_SECURE=false`
gesetzt werden, sonst verwirft der Browser das Login-Cookie.
