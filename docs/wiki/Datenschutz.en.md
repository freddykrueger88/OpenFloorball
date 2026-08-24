# 🛡️ GDPR & Privacy

*[🇩🇪 Deutsch](Datenschutz.md) | 🇬🇧 English*

OpenFloorball is self-hosted – the operator of a given instance is
responsible under data protection law, not the OpenFloorball
developers. The app itself follows the principle of **data
minimization** in its data model (GDPR Art. 5(1)(c)).

The full privacy policy shown in the app lives at `/privacy`
(`frontend/src/pages/PrivacyPage.jsx`) and covers:

- **Data categories**: account (email, password hash), board content,
  settings
- **Purpose of processing**
- **Data subject rights**: access, export (`GET /api/user/export`),
  rectification, deletion (`DELETE /api/user/account`)
- **Public share links**: expire automatically after
  `SHARE_LINK_EXPIRES_HOURS` (see
  [Environment variables](./Umgebungsvariablen.en.md))
- **No third parties/tracking**: no external CDNs, no analytics
  services embedded

## Concretely implemented in code

- No personally identifiable data (email, real name) in server logs
  where a user ID is enough for traceability
- Log files with a size/rotation limit (`maxsize`/`maxFiles`), no
  unbounded growth
- Backups expire automatically (configurable retention, see
  [Backup](./Backup.en.md))
- Email delivery is purely functional (collaborator notifications), no
  marketing/tracking – see [Email delivery](./E-Mail-Versand.en.md)

Details and reasoning behind individual decisions: `CLAUDE.md` in the
repository root (project guidelines for contributions).
