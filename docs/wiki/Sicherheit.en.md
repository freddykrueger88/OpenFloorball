# 🔒 Security notes

*[🇩🇪 Deutsch](Sicherheit.md) | 🇬🇧 English*

The full security policy lives in the repository:

👉 **[SECURITY.md](../../SECURITY.md)**

Summary of the key design decisions:

- Passwords hashed with `bcrypt` (min. 12 rounds), never stored or
  logged in plain text
- Sessions via HttpOnly cookies + JWT, Redis blacklist for logged-out/
  deleted accounts
- `JWT_SECRET` is checked for a minimum length at server startup – a
  missing or too-short value prevents the server from starting
- `COOKIE_SECURE=true` by default (HTTPS-only), deliberately
  switchable off for plain home-network use without TLS (see
  [Environment variables](./Umgebungsvariablen.en.md))
- Weekly `npm audit` + `dependency-review-action` on every PR

## Reporting a vulnerability

**Not** as a public GitHub issue. Via the repository's Security tab:
[github.com/freddykrueger88/OpenFloorball/security/advisories/new](https://github.com/freddykrueger88/OpenFloorball/security/advisories/new).

## TLS/HTTPS for self-hosting

For instances with their own domain, an optional Caddy overlay
(`docker-compose.tls.yml`) is available that automatically obtains a
Let's Encrypt certificate:

```bash
DOMAIN=openfloorball.example.com docker compose \
  -f docker-compose.yml -f docker-compose.tls.yml up -d
```

Without a TLS reverse proxy on a plain home network, `COOKIE_SECURE=false`
must be set, otherwise the browser rejects the login cookie.
