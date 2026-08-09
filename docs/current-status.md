# Aktueller Entwicklungsstand

> Diese Seite beantwortet direkt die Frage "Wie weit ist OpenFloorball
> aktuell?" – faktenbasiert, aus dem Code und der Commit-/Issue-
> Historie abgeleitet, nicht aus Marketing-Formulierungen. Stand:
> Version 0.9.0, Commit vom 2026-08-08.

## Current Status

OpenFloorball ist ein selbst gehostetes, funktionsfähiges Taktikboard
für Floorball-Trainer mit deutlich mehr Funktionsumfang als ein reines
MVP: neben dem Kern-Taktikboard existieren bereits Trainingsplanung,
Team-/Vereinsverwaltung, eine Community-Übungsbibliothek, vier
optionale KI-Assistenten, Video-Integration und Echtzeit-
Zusammenarbeit. Das Projekt befindet sich in aktiver Entwicklung
(fast täglich neue Commits) und wird bereits produktiv von mindestens
einem Verein im Trainingsalltag eingesetzt. Es fehlen noch einzelne,
konkret benennbare Bausteine bis zu einer "1.0" (siehe "Noch offen").

## Implementiert

- **Taktikboard-Editor**: IFF-konformes Spielfeld (Großfeld/Kleinfeld/
  Street/3vs3), Drag-&-Drop-Spielerplatzierung, Zeichenwerkzeuge
  (Bewegungs-/Pass-/Schusspfeile, Freihand), Frame-by-Frame-Animation,
  automatische Versionierung (bis zu 50 Snapshots/Board,
  wiederherstellbar).
- **Lines** – taktische Zusammenstellungen echter Kader-Spieler
  (Sturm-/Defensivreihen/Special-Teams), ein Spieler kann in beliebig
  vielen Lines stehen, schneller Wechsel direkt auf der Spielseite.
  Details: [Lines](./wiki/Lines.md). **Formationsvorlagen, Playbooks**
  – wiederverwendbare Aufstellungen, Board-Sammlungen.
- **Trainingsplaner** – Trainingseinheiten mit Übungen, referenziert
  Boards live per Fremdschlüssel statt Kopie.
- **Live-Spielnotizen** – Spiele anlegen (Gegner/Datum, optional
  team-geteilt), während des laufenden Spiels schnelle,
  zeitgestempelte Notizen erfassen. Details: [Live-Spielnotizen](./wiki/Live-Spielnotizen.md).
- **Team-Kader**, **Teams und Vereine** – zweistufiges Rollenmodell
  je Ebene (Details: [docs/wiki/Teams-und-Vereine.md](./wiki/Teams-und-Vereine.md)).
- **Board-Sharing** – Kollaboratoren (nur Owner verwaltet),
  E-Mail-Einladungen auch für noch nicht registrierte Adressen,
  öffentliche Share-Links (ganzes Board oder einzelnes Frame).
- **Community-Bibliothek** – Boards als Snapshot veröffentlichen,
  durchsuchen, klonen, melden, moderieren.
- **Vier KI-Assistenten** (Training/Taktik/Analyse/Wissen) – optional,
  austauschbarer Anbieter (OpenAI-kompatible Schnittstelle, kein
  Vendor-Lock-in), liefern nur Textentwürfe, kein Auto-Save.
- **Video-Integration** – Upload, Streaming mit Range-Requests,
  Zeichnen-Überlagerung, Trimmen, Szenen-Marken, Übernahme der
  Video-Zeichnung als neues, eigenständiges Taktik-Board ("Video →
  Taktik-Board" – siehe [Video-Integration](./wiki/Video-Integration.md)).
- **Echtzeit-Präsenz** – Präsenz-Badges und Live-Cursor beim
  gemeinsamen Bearbeiten (WebSocket, keine Persistenz).
- **Export** – GIF/MP4 (asynchron, FFmpeg), PDF-Taktikblätter
  (synchron).
- **Kommentare** auf Boards und Trainingseinheiten.
- **Admin-Bereich** – Nutzerverwaltung, Bibliotheks-Moderation,
  Backup-Zeitplan, KI-Anbieter-Konfiguration.
- **DSGVO/GDPR** – Datenauskunft (Art. 15), Backup-Export/Import (ZIP,
  Boards inkl. Frames, Kader, Lines – siehe "Teilweise implementiert"),
  Account-Löschung inkl. Anonymisierung veröffentlichter
  Bibliothekseinträge.
- **Automatische Backups** (Cron, konfigurierbares Zeitplan/
  Aufbewahrung) sowie ein manueller "Jetzt ausführen"-Button im
  Admin-Bereich für einen sofortigen Lauf unabhängig vom Zeitplan.
- **Onboarding-Tour** für neue Nutzer (überspringbar, wiederholbar) und
  **vertiefte Editor-Tour** (Backlog-ISSUE 024) direkt im Board-Editor
  – zwei unabhängige Touren mit getrennten "gesehen"-Status
  (`tourCompleted`/`editorTourCompleted`), Überspringen/Abschließen
  der einen beeinflusst die andere nicht. Die Editor-Tour ist über ein
  Hilfe-Symbol im Editor jederzeit erneut aufrufbar (startet einmal
  automatisch pro Account, nicht pro einzelnem neuen Board – bewusste
  Abweichung von der wörtlichen Backlog-Formulierung "beim ersten
  Öffnen eines neu erstellten Boards", um nicht bei jedem neuen Board
  erneut zu erscheinen).
- **Passwort-Reset-Flow** – E-Mail-Link mit einmal verwendbarem, eine
  Stunde gültigem Token (Hash statt Klartext in der DB, im Gegensatz
  zu Share-/Invite-Tokens bewusst die einzige Ausnahme – Besitz
  erlaubt volle Account-Übernahme). Generische Antwort unabhängig
  davon, ob die E-Mail existiert (keine Enumeration). Erfordert
  konfigurierten SMTP-Versand (siehe [E-Mail-Versand](./wiki/E-Mail-Versand.md));
  ohne SMTP bleibt die Funktion ohne Fehlermeldung wirkungslos.
- **PWA** – installierbar, Service-Worker-Cache für die App-Shell.
- Zweisprachig (Deutsch/Englisch).
- **Barrierefreiheit** – Farbenblind-Filter, Screenreader-Live-Region,
  Tastaturbedienung, Schriftgrößen-/ADHS-/Legasthenie-Einstellungen.
- **CI/CD** – GitHub Actions (Lint/Test/Build für Backend & Frontend,
  Docker-Build-Check, Security-Scan, Dependency-Review).

## Teilweise implementiert

- **Offline-Modus**: PWA-Cache und lokale Schreib-Warteschlange
  funktionieren; Konflikterkennung beim Wiederverbinden gibt es für
  Boards, Frames, Trainingseinheiten, Kader-Einträge sowie (seit
  Kurzem) Playbooks und Formationsvorlagen – deren Bearbeiten-Feature
  ist bewusst auf Umbenennen begrenzt (Feldtyp/Spieler-Aufstellung
  ändert man durch Anlegen einer neuen Vorlage).
- **Echtzeit-Zusammenarbeit**: zeigt Präsenz und Live-Cursor an, führt
  aber bewusst keine serverseitige Konfliktauflösung oder
  Zusammenführung von Änderungen durch – rein informativ, kein
  Ersatz für die Konflikterkennung des Offline-Modus.
- **Backup-Export/Import (GDPR)**: enthält Boards (inkl. Frames), Kader
  und Lines. Formationsvorlagen, Playbooks und Trainingspläne sind
  aktuell nicht Teil des Backups – wer diese Daten sichern will, muss
  die entsprechenden Vorlagen/Trainingspläne aktuell manuell notieren.

## In Entwicklung

Aktuell befindet sich kein Feature in einem sichtbar unfertigen
Zwischenzustand im Code – die zuletzt gemergten Arbeiten (Onboarding-
Tour, Erweiterung der Offline-Konfliktlösung auf Trainingseinheiten/
Kader, CI-Fix) sind abgeschlossen. Die nächsten Schritte liegen als
konkrete Backlog-Einträge vor (siehe unten).

## Noch offen

- **Native App-Store-Präsenz** (Google Play/Apple App Store) – bisher
  nur als installierbare PWA, kein nativer Wrapper.
- **Vite 8 / ESLint 10** im Frontend – Upgrade blockiert durch
  Peer-Dependency-Konflikte im jeweiligen Ökosystem (zuletzt
  2026-08-07 erneut geprüft).
- **Formale Barrierefreiheits-Zertifizierung** (WCAG 2.1 AA/BITV 2.0/
  EN 301 549 durch Dritte) steht aus – die Funktionen selbst sind
  umgesetzt, aber nicht extern zertifiziert.

## Bekannte Probleme

- Nur zwei der neun im CHANGELOG dokumentierten Versionen (v0.1.0,
  v0.9.0) haben ein Git-Tag; die Zwischenversionen 0.2.0–0.8.0
  existieren nur als CHANGELOG-Abschnitte, nicht als Tag/Release.

## Nächste Schritte

1. Vite 8 / ESLint 10 aktualisieren, sobald die
   Peer-Dependency-Konflikte in den jeweiligen Ökosystemen gelöst sind.
2. Native App-Store-Präsenz prüfen (PWA-Wrapper wie Capacitor/Trusted
   Web Activity).

## Technischer Stand

| Bereich | Stand |
|---|---|
| Version | 0.9.0 (`backend/package.json` und `frontend/package.json`) |
| Backend | Node ≥24, Express 5, PostgreSQL 18, Redis 8 |
| Frontend | React 19, Vite 7, react-router 8, zustand 5, Konva 10/react-konva 19, i18next (DE/EN) |
| PWA | `vite-plugin-pwa`, echt konfiguriert (Workbox-Caching, Manifest) |
| Tests | 33 Backend-Testdateien, 18 Frontend-Testdateien |
| CI/CD | GitHub Actions – Lint/Test/Build (Backend + Frontend), Docker-Build-Check, Security-Scan, Dependency-Review |
| Deployment | Docker Compose, optionales TLS-Overlay (Caddy) |
| Lizenz | MIT |
| GitHub-Issues | 30 geschlossen, 0 offen (Stand dieses Audits) |

## Weiterführend

- [docs/wiki/Home.md](./wiki/Home.md) – vollständiges Wiki
- [CHANGELOG.md](../CHANGELOG.md) – detaillierte Versionshistorie
- [docs/planning/BACKLOG.md](./planning/BACKLOG.md) – einzelne
  geplante Issues
- [docs/planning/ROADMAP.md](./planning/ROADMAP.md) – langfristige
  Vision/Phasen
