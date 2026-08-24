# 🛡️ DSGVO & Datenschutz

*🇩🇪 Deutsch | [🇬🇧 English](Datenschutz.en.md)*

OpenFloorball ist self-hosted – der Betreiber der jeweiligen Instanz ist
datenschutzrechtlich verantwortlich, nicht die OpenFloorball-Entwickler.
Die App selbst folgt beim Datenmodell dem Grundsatz der
**Datensparsamkeit** (DSGVO Art. 5 Abs. 1c).

Die vollständige, in der App angezeigte Datenschutzerklärung liegt
unter `/privacy` (`frontend/src/pages/PrivacyPage.jsx`) und
umfasst:

- **Datenkategorien**: Konto (E-Mail, Passwort-Hash), Board-Inhalte,
  Einstellungen
- **Zweck der Verarbeitung**
- **Betroffenenrechte**: Auskunft, Export (`GET /api/user/export`),
  Berichtigung, Löschung (`DELETE /api/user/account`)
- **Öffentliche Share-Links**: laufen automatisch nach
  `SHARE_LINK_EXPIRES_HOURS` ab (siehe
  [Umgebungsvariablen](./Umgebungsvariablen.md))
- **Keine Drittanbieter/Tracking**: keine externen CDNs, keine
  Analytics-Dienste eingebunden

## Konkret im Code umgesetzt

- Keine personenbezogenen Daten (E-Mail, Klarname) in Server-Logs, wo
  eine User-ID zur Nachverfolgung reicht
- Log-Dateien mit Größen-/Rotationsgrenze (`maxsize`/`maxFiles`), kein
  unbegrenztes Wachstum
- Backups laufen automatisch ab (konfigurierbare Aufbewahrung, siehe
  [Backup](./Backup.md))
- E-Mail-Versand ist rein funktional (Kollaborator-Benachrichtigung),
  kein Marketing/Tracking – siehe [E-Mail-Versand](./E-Mail-Versand.md)

Details und Begründungen für einzelne Entscheidungen: `CLAUDE.md` im
Repository-Root (Projektrichtlinien für Beiträge).
