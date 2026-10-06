# 📋 Audit-Log

*🇩🇪 Deutsch | [🇬🇧 English](Audit-Log.en.md)*

Append-only Protokoll aller sicherheits- und Compliance-relevanten
Aktionen in OpenFloorball. Jeder Eintrag erfasst **wer, wann, welche
Aktion** ausgeführt hat, inkl. Vorher/Nachher-Delta und Metadaten.
Das Audit-Log dient der Nachvollziehbarkeit gemäß den Anforderungen
aus dem Statistik-Architektur-Dokument (EPIC 012).

## Was wird protokolliert?

| Kategorie | Beispiele |
|---|---|
| **Berechtigungen / Rollen** | Admin-User-Rolle ändern, Team-Mitglieder hinzufügen/entfernen, Vereins-Mitglieder, Board-Kollaboratoren inkl. Einladungen |
| **Löschungen** | Admin-User-Löschung, Selbst-Löschung des Accounts |
| **Datenexporte** | PDF-Taktikblatt, Spielbericht, CSV Roster/Games, GIF/MP4, DSGVO-ZIP-Backup |
| **Admin-Aktionen** | Backup-Config/-Run, KI-Anbieter-Konfiguration (API-Keys werden **bewusst nie** im Audit gespeichert) |

## Technische Umsetzung

- Append-only-Tabelle `audit_log` in PostgreSQL
- Zentraler Service: `auditLogger` (importierbar in jedem Route-Handler)
- Bestehende Endpunkte werden durch das Audit nicht in ihrem
  Verhalten verändert

## Einsicht

Das Audit-Log ist im Admin-Bereich unter den administrativen
Einstellungen einsehbar. Details zu den konkreten Spalten und
Berechtigungen: siehe
[API-Dokumentation](./API.md) (internes Admin-Modul).

---

> Changelog-Referenz: Unreleased – Generisches Audit-Log, siehe
> [CHANGELOG.md](../../CHANGELOG.md)
