# 🔌 API-Dokumentation

*🇩🇪 Deutsch | [🇬🇧 English](API.en.md)*

REST-API unter `/api`. Authentifizierung über HttpOnly-Session-Cookie
(JWT), gesetzt durch `POST /api/auth/login` bzw. `/register`. Es gibt
kein separates API-Token-System – die API ist für das eigene Frontend
gedacht, nicht als öffentliche Drittanbieter-Schnittstelle.

Alle Antworten folgen dem Schema `{ success: boolean, data?, message?
}`. Fehlerhafte Eingaben liefern `422` mit Validierungsdetails
(express-validator), fehlende Berechtigung `401`/`404` (bewusst `404`
statt `403` bei fremden Ressourcen, um nicht zu verraten, ob eine
Ressourcen-ID überhaupt existiert).

## Auth

| Methode | Pfad | Beschreibung |
|---|---|---|
| POST | `/api/auth/register` | Registrieren (erster Nutzer = Admin) |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/logout` | Logout (auth.) |
| GET | `/api/auth/me` | Eigenes Profil (auth.) |
| PUT | `/api/auth/name` | Namen ändern (auth.) |
| PUT | `/api/auth/email` | E-Mail ändern (auth.) |
| PUT | `/api/auth/password` | Passwort ändern (auth.) |
| POST | `/api/auth/forgot-password` | Reset-Link per E-Mail anfordern (öffentlich, immer generische Antwort – keine Enumeration) |
| POST | `/api/auth/reset-password` | Neues Passwort mit Token setzen (öffentlich, Token einmal verwendbar, 1h gültig) |

## Boards

| Methode | Pfad | Beschreibung |
|---|---|---|
| GET | `/api/boards` | Eigene + geteilte Boards |
| GET | `/api/boards/:id` | Einzelnes Board |
| POST | `/api/boards` | Board anlegen |
| PUT | `/api/boards/:id` | Board ändern |
| DELETE | `/api/boards/:id` | Board löschen (Owner-only) |
| POST | `/api/boards/:id/share` | Öffentlichen Share-Link erzeugen |

## Frames

| Methode | Pfad | Beschreibung |
|---|---|---|
| GET | `/api/boards/:id/frames` | Frames eines Boards |
| POST | `/api/boards/:id/frames` | Frame anlegen |
| PUT | `/api/boards/:id/frames/reorder` | Reihenfolge ändern |
| PUT | `/api/boards/:id/frames/:frameId` | Frame ändern |
| DELETE | `/api/boards/:id/frames/:frameId` | Frame löschen |

## Board-Kollaboratoren

| Methode | Pfad | Beschreibung |
|---|---|---|
| GET | `/api/boards/:id/collaborators` | Liste (Owner-only) |
| POST | `/api/boards/:id/collaborators` | Hinzufügen per E-Mail, max. 10/Board (Owner-only) |
| PUT | `/api/boards/:id/collaborators/:collaboratorId` | Berechtigung ändern (Owner-only) |
| DELETE | `/api/boards/:id/collaborators/:collaboratorId` | Entfernen (Owner-only) |
| GET | `/api/invite/:token` | Offene Einladung ansehen (öffentlich, keine Auth) |

## Board-Versionen

| Methode | Pfad | Beschreibung |
|---|---|---|
| GET | `/api/boards/:id/versions` | Liste aller Snapshots (max. 50/Board) |
| GET | `/api/boards/:id/versions/:versionId` | Vollständiger Snapshot |
| POST | `/api/boards/:id/versions/:versionId/restore` | Wiederherstellen (sichert vorher den aktuellen Stand) |

## Video

| Methode | Pfad | Beschreibung |
|---|---|---|
| GET | `/api/boards/:id/videos` | Liste (max. 5/Board) |
| POST | `/api/boards/:id/videos` | Hochladen (MP4/WebM/MOV, max. 200 MB) |
| GET | `/api/boards/:id/videos/:videoId/stream` | Wiedergabe (Range-Requests) |
| PUT | `/api/boards/:id/videos/:videoId` | Ändern (Zeichnen-Overlay, Trim, Marken) |
| DELETE | `/api/boards/:id/videos/:videoId` | Löschen |

## Kommentare

Gemountet auf zwei Ressourcen mit identischer Struktur:
`/api/boards/:id/comments` und `/api/trainings/:id/comments`.

| Methode | Pfad | Beschreibung |
|---|---|---|
| GET | `.../comments` | Liste |
| POST | `.../comments` | Anlegen (max. 500/Ressource) |
| PUT | `.../comments/:commentId` | Ändern (nur Autor) |
| DELETE | `.../comments/:commentId` | Löschen (Autor oder jeder mit Schreibrecht an der Ressource) |

## Export

| Methode | Pfad | Beschreibung |
|---|---|---|
| POST | `/api/export/gif` | GIF-Export starten (async) |
| POST | `/api/export/mp4` | MP4-Export starten (async) |
| POST | `/api/export/pdf` | PDF-Export (synchron) |
| GET | `/api/export/status/:id` | Job-Status abfragen |
| GET | `/api/export/download/:id` | Fertige Datei herunterladen |

## Öffentliche Share-Ansicht

| Methode | Pfad | Beschreibung |
|---|---|---|
| GET | `/api/share/:token` | Board lesen ohne Login (bewusst **nicht** hinter Auth) |
| POST | `/api/export/frame-share` | Einzelnes Frame als PNG-Share-Link erzeugen (max. 5 MB) |
| GET | `/api/share/frame/:token` | Frame-Share-Bild ansehen (öffentlich) |

## Settings

| Methode | Pfad | Beschreibung |
|---|---|---|
| GET | `/api/settings` | Eigene Einstellungen |
| PUT | `/api/settings` | Teilweises Update (merge) |

## User

| Methode | Pfad | Beschreibung |
|---|---|---|
| DELETE | `/api/user/account` | Account löschen |
| GET | `/api/user/data` | Eigene Kontodaten |
| GET | `/api/user/export` | Vollständiger Datenexport (DSGVO) |
| POST | `/api/user/import` | Datenimport |

## Admin

Nur für Nutzer mit Admin-Rolle.

| Methode | Pfad | Beschreibung |
|---|---|---|
| GET | `/api/admin/users` | Alle Nutzer |
| DELETE | `/api/admin/users/:id` | Nutzer löschen |
| PUT | `/api/admin/users/:id/role` | Rolle ändern |
| GET | `/api/admin/backup-config` | Backup-Zeitplan lesen |
| PUT | `/api/admin/backup-config` | Backup-Zeitplan ändern |
| POST | `/api/admin/backup-run` | Backup sofort ausführen (unabhängig vom Zeitplan) |
| GET | `/api/admin/library-reports` | Gemeldete Bibliothekseinträge |
| GET | `/api/admin/ai-config` | KI-Anbieter-Konfiguration lesen (API-Key nur als "gesetzt/nicht gesetzt") |
| PUT | `/api/admin/ai-config` | KI-Anbieter-Konfiguration ändern |

## Formationen

| Methode | Pfad | Beschreibung |
|---|---|---|
| GET | `/api/formations` | Eigene Vorlagen |
| POST | `/api/formations` | Vorlage speichern (max. 20) |
| DELETE | `/api/formations/:id` | Vorlage löschen |

## Playbooks

| Methode | Pfad | Beschreibung |
|---|---|---|
| GET | `/api/playbooks` | Eigene Playbooks |
| POST | `/api/playbooks` | Playbook anlegen (max. 15) |
| DELETE | `/api/playbooks/:id` | Playbook löschen |

## Trainingspläne

| Methode | Pfad | Beschreibung |
|---|---|---|
| GET | `/api/trainings` | Eigene Trainingspläne |
| POST | `/api/trainings` | Trainingsplan anlegen |
| GET | `/api/trainings/:id` | Einzelner Trainingsplan (inkl. Items) |
| PUT | `/api/trainings/:id` | Trainingsplan ändern |
| DELETE | `/api/trainings/:id` | Trainingsplan löschen |
| POST | `/api/trainings/:id/items` | Übung (Board-Referenz) hinzufügen |
| PUT | `/api/trainings/:id/items/reorder` | Reihenfolge ändern |
| PUT | `/api/trainings/:id/items/:itemId` | Übung ändern |
| DELETE | `/api/trainings/:id/items/:itemId` | Übung entfernen |

## Kader (Roster)

| Methode | Pfad | Beschreibung |
|---|---|---|
| GET | `/api/roster` | Eigener Kader (+ team-geteilte Einträge) |
| POST | `/api/roster` | Spieler anlegen (max. 40, optional teamId) |
| GET | `/api/roster/:id` | Einzelner Kader-Spieler |
| PUT | `/api/roster/:id` | Spieler ändern |
| DELETE | `/api/roster/:id` | Spieler löschen (räumt seine Line-Zuordnungen mit auf) |

## Lines

Nutzer-/team-gebunden wie Kader/Spiele, **nicht** board-gebunden. Ein
Kader-Spieler kann in beliebig vielen Lines stehen (many-to-many über
die interne `line_players`-Tabelle) – siehe [Lines](./Lines.md).

| Methode | Pfad | Beschreibung |
|---|---|---|
| GET | `/api/lines` | Eigene Lines (+ team-geteilte) |
| POST | `/api/lines` | Line anlegen (max. 20) |
| PUT | `/api/lines/:id` | Line ändern (Name/Farbe/Typ) |
| DELETE | `/api/lines/:id` | Line löschen (Spieler bleiben im Kader) |
| POST | `/api/lines/:id/players` | Kader-Spieler zur Line hinzufügen |
| DELETE | `/api/lines/:id/players/:rosterPlayerId` | Spieler aus der Line entfernen |
| PUT | `/api/lines/:id/active` | Aktivieren/Deaktivieren (deaktiviert andere Lines derselben Gruppe) |

## Spiele (Live-Spielnotizen)

Nutzer-/team-gebunden, nicht board-gebunden. Die Notizen selbst laufen
über die Kommentar-Infrastruktur (`resource_type='game'`) – siehe
[Live-Spielnotizen](./Live-Spielnotizen.md).

| Methode | Pfad | Beschreibung |
|---|---|---|
| GET | `/api/games` | Eigene Spiele (+ team-geteilte) |
| POST | `/api/games` | Spiel anlegen (max. 30) |
| GET | `/api/games/:id` | Einzelnes Spiel |
| PUT | `/api/games/:id` | Spiel ändern (Gegner/Datum/Notizen) |
| DELETE | `/api/games/:id` | Spiel löschen (räumt seine Notizen mit auf) |
| GET | `/api/games/:id/comments` | Live-Notizen des Spiels |
| POST | `/api/games/:id/comments` | Notiz hinzufügen (Lesezugriff genügt) |
| DELETE | `/api/games/:id/comments/:commentId` | Notiz löschen (Autor oder Schreibzugriff) |

## Teams

| Methode | Pfad | Beschreibung |
|---|---|---|
| GET | `/api/teams` | Eigene Teams |
| POST | `/api/teams` | Team anlegen |
| GET | `/api/teams/:id` | Einzelnes Team |
| PUT | `/api/teams/:id` | Team ändern (owner/coach) |
| DELETE | `/api/teams/:id` | Team löschen (owner) |
| GET | `/api/teams/:id/members` | Mitgliederliste |
| POST | `/api/teams/:id/members` | Mitglied einladen (bestehender Account nötig) |
| PUT | `/api/teams/:id/members/:memberId` | Rolle ändern |
| DELETE | `/api/teams/:id/members/:memberId` | Mitglied entfernen |

## Organizations (Vereine)

| Methode | Pfad | Beschreibung |
|---|---|---|
| GET | `/api/organizations` | Eigene Vereine |
| POST | `/api/organizations` | Verein anlegen |
| GET | `/api/organizations/:id` | Einzelner Verein |
| PUT | `/api/organizations/:id` | Verein ändern (admin) |
| DELETE | `/api/organizations/:id` | Verein löschen (admin) |
| GET | `/api/organizations/:id/members` | Mitgliederliste |
| POST | `/api/organizations/:id/members` | Mitglied einladen |
| PUT | `/api/organizations/:id/members/:memberId` | Rolle ändern |
| DELETE | `/api/organizations/:id/members/:memberId` | Mitglied entfernen |

## Community-Bibliothek

| Methode | Pfad | Beschreibung |
|---|---|---|
| GET | `/api/library` | Durchsuchen (Kategorie-Filter, Textsuche, paginiert) |
| GET | `/api/library/:id` | Einzelner Eintrag |
| POST | `/api/boards/:id/publish` | Board als Snapshot veröffentlichen (Owner-only) |
| POST | `/api/library/:id/clone` | Als eigenes Board übernehmen |
| POST | `/api/library/:id/report` | Eintrag melden |
| DELETE | `/api/library/:id` | Löschen (Ersteller oder Admin) |

## KI-Assistenten

Sichtbar/nutzbar nur, wenn ein KI-Anbieter konfiguriert ist (siehe
[KI-Assistenten](./KI-Assistenten.md)). Liefern ausschließlich
Textentwürfe, kein Auto-Save.

| Methode | Pfad | Beschreibung |
|---|---|---|
| GET | `/api/ai/status` | Ob/welcher KI-Anbieter konfiguriert ist |
| POST | `/api/ai/training-plan` | Trainingsassistent |
| POST | `/api/ai/tactic-suggestion` | Taktikassistent |
| POST | `/api/ai/analysis` | Analyseassistent |
| POST | `/api/ai/knowledge-query` | Wissensassistent (nur Antwort, wenn eigene Treffer gefunden werden) |

## Fehlercodes

| Code | Bedeutung |
|---|---|
| `400` | Ungültige Anfrage (z. B. Limit erreicht, Selbst-Referenz) |
| `401` | Nicht authentifiziert |
| `404` | Ressource nicht gefunden **oder** kein Zugriff |
| `422` | Validierungsfehler (express-validator) |
| `500` | Interner Serverfehler |
