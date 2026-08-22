# Changelog

Alle wichtigen Änderungen an OpenFloorball werden in dieser Datei dokumentiert.
Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.0.0/).
Versionierung nach [Semantic Versioning](https://semver.org/lang/de/).

> ⚠️ **Hinweis:** Dieses Projekt wurde als Konzept von einem Menschen erdacht.
> Die Implementierung erfolgte durch KI (AI-Slop). Bei kommerziellem Einsatz
> wird der Ideengeber als Urheber genannt und erhält lebenslang kostenlosen
> Top-Premium-Tier-Zugang, unwiderruflich.

---

## [Unreleased]

### Added
- Statistik-Architektur Phase 9 (EPIC 012): Spiel-Insights-Assistent
  ("KI-Spielanalyse" auf der Spielseite, AI_SYSTEM.md §5.5) – fünfter
  KI-Assistent, baut auf derselben KI-Provider-Abstraktion wie die
  bestehenden vier (EPIC 010) auf. Bekommt ausschließlich bereits
  berechnete Team-Statistiken dieses Spiels (Schuss-/Special-Teams-/
  Situations-Kennzahlen), keine Rohereignisse, keine Personendaten, und
  sucht darin nach Mustern/möglichen Trainingsschwerpunkten. "Grundlage
  anzeigen" macht sichtbar, welche Zahlen tatsächlich an die KI gingen.
  Damit sind alle 9 Phasen der EPIC-012-Statistik-Architektur
  umgesetzt (xG v1 bewusst zurückgestellt, siehe Phase 8).

### Added
- Statistik-Architektur Phase 8 (EPIC 012): Line-Chemie. Neuer Bereich
  "Line-Chemie (Saison)" auf `/lines` zeigt Zeit-auf-dem-Feld und
  Torverhältnis je Line über die gesamte Saison statt nur ein einzelnes
  Spiel – reine Aggregation der bereits bestehenden Formel
  (`calculateLineStats`), keine neuen Daten nötig. xG v1/Shot Quality
  bleiben nach einem Datenbasis-Check zurückgestellt (keine ausreichende
  Schussdaten-Grundlage).

### Added
- Statistik-Architektur Phase 7 (EPIC 012): Custom Events/Tags + CSV-Export
  (ADR-0006). Trainer können eigene, kurze Ereignistypen anlegen
  (team-eigen oder persönlich, z.B. "Konter") und in der Spiel-Zeitleiste
  taggen – inklusive Video-Verknüpfung wie bei den eingebauten Typen.
  Auf `/stats` und `/games` lassen sich die Saison-Kennzahlen bzw. die
  Spieleliste zusätzlich als CSV-Datei exportieren (Excel/Sheets-fähig).

### Added
- Statistik-Architektur, Phasenplanungs-Review 2026-08-21 (EPIC 012):
  Vorlagen (Assists) und Punkte. Das Datenfeld dafür existierte bereits
  seit Phase 1, wurde aber nie über eine UI befüllt – jetzt über "Schuss
  erfassen" bei eigenem Tor auswählbar (Kader-Spieler außer dem
  Torschützen selbst). Neue Spalten "Vorlagen"/"Punkte" in der
  Statistik-Übersicht, im Spieler-Vergleich und auf der Trends-Seite
  (Last-5/Last-10/Saison). Bewusst nicht beim schnellen "Tor"-Preset,
  um die Live-Eingabe nicht zu verlangsamen.
- Statistik-Architektur Phase 6 (EPIC 012): Video-Integration. Bis zu 5
  Videos direkt an ein Spiel hängbar (neue `game_videos`-Tabelle, ADR-0005
  in `docs/planning/DECISIONS.md`), mit derselben Zeichnen-/Trimmen-/
  Marken-Funktionalität wie bei Board-Videos. Zusätzlich lässt sich die
  aktuelle Videoposition mit einem bereits erfassten Ereignis aus der
  Spiel-Zeitleiste verknüpfen (live oder nachträglich beim Video-Review)
  – ein verknüpftes Ereignis springt per Klick zur passenden Stelle im
  Video.

### Added
- Statistik-Architektur Phase 5 (EPIC 012): Trainings-Analytics/
  Spielerentwicklung. Tatsächliche Trainings-Anwesenheit je
  Kader-Spieler (präsent/entschuldigt/unentschuldigt/verletzt,
  unabhängig von RSVP) direkt auf der Trainings-Seite erfassbar. Freie,
  zeitgestempelte Spielerentwicklungsnotizen eines Coaches (nur coach/
  owner, nie 'member', da personenbezogene Daten über einen Spieler)
  auf der Trends-Seite eines Spielers. Trainings-Beteiligungsquote
  (erfasste Trainings/Anwesenheits-%) in der Statistik-Übersicht und
  als Last-5/Last-10/Saison-Trend, analog zum bestehenden
  Spiel-Trend-Muster aus Phase 4.

### Added
- Statistik-Architektur Phase 4 (EPIC 012): Special Teams (Powerplay-%/
  Penalty-Kill-%, abgeleitet aus Strafen + Spieluhr, mit dokumentierten
  Vereinfachungen statt erfundener Präzision, siehe ADR-0004),
  Situations-Splits (Tore/Schüsse nach Spielstand
  Führung/Rückstand/Unentschieden und nach Periode), Spieler-Vergleich
  (bis zu 4 Kader-Spieler nebeneinander auf der Statistikseite) und
  Trends (Spiel-für-Spiel-Verlauf eines Spielers unter `/stats/:id`
  mit Last-5/Last-10/Saison-Vergleich). Neue Sektionen "Special teams"
  und "Situational splits" auf der Spielseite.

### Changed
- `strengthState` (Kräfteverhältnis je Spielereignis) wird ab sofort
  ausschließlich serverseitig berechnet – ein vom Client mitgesendeter
  Wert wird stillschweigend ignoriert (analog zu `period` und
  `clockSecondsAtEvent` seit Phase 1). Kein bekannter Frontend-Code
  hat dieses Feld bisher gesetzt, daher kein tatsächlicher Breaking
  Change für die ausgelieferte UI (siehe ADR-0004).

### Added
- Statistik-Architektur Phase 3 (EPIC 012): Schuss-Tracking, Shot Map
  und einfache Torhüter-Statistiken. Ein neuer "Schuss erfassen"-Button
  auf der Spielseite öffnet ein Panel mit Zuordnung, Position (eigenes,
  floorball-eigenes Zonen-Diagramm statt Eishockey-Geometrie),
  Schusstyp und Ergebnis (Tor/Gehalten/Verfehlt/Geblockt). Ein Schuss
  mit Ergebnis "Tor" erzeugt automatisch ein verknüpftes Tor-Ereignis,
  sodass Live-Spielstand und bestehende Statistiken unverändert
  funktionieren (kein doppelter Erfassungsschritt). Neue
  "Schuss-Statistiken"-Sektion (inkl. Shot Map) und
  "Torhüter-Statistiken"-Sektion auf der Spielseite, neue Spalten
  (Schüsse/Schuss-%/Gegentore/Fangquote) auf der Saison-Statistikseite.
  Das bestehende einfache "Tor"-Preset bleibt unverändert als schnelle
  Alternative erhalten – additiv, kein Ersatz.
- Statistik-Architektur Phase 2 (EPIC 012): strukturiertes
  Match-Line/Shift-Tracking – jeder Line-Wechsel während eines Spiels
  legt jetzt zusätzlich zur bestehenden Freitext-Notiz eine
  zeitgestempelte `match_lines`-Zeile an (Aktivieren einer neuen Line
  schließt die vorherige automatisch). Neue "Line-Statistiken"-Sektion
  auf der Spielseite zeigt je Line Zeit-zusammen und
  Goals-For/Against, live berechnet über die zentrale
  `statisticsEngine.js` (`calculateLineStats`). Additiv – die
  bestehende `lines.is_active`-Taktikvorlage und die Freitext-Notiz im
  Zeitleisten-Verlauf bleiben unverändert.
- Vereinsweite Termin-Übersicht (EPIC 011, erster Baustein): das
  Verein-Dashboard zeigt Vereinsadmins jetzt zusätzlich eine
  gebündelte, rein lesende Liste aller anstehenden Spiele und
  Trainingseinheiten über alle Teams des Vereins hinweg – nützlich bei
  mehreren Sparten (z.B. 1. Herren, U15), um Terminüberschneidungen
  bei der Hallenbelegung zu erkennen. Kein neuer Bearbeitungsweg, für
  einfache Mitglieder unsichtbar, keine neue Migration (reine
  Lese-Query über bestehende `games`/`training_sessions`/`teams`).
- Vereinsebene ausgebaut: jeder Verein hat jetzt ein eigenes Dashboard
  (`/organizations/:id`) statt nur ein aufklappbares Listenelement in
  den Einstellungen zu sein – Umbenennen, Mitgliederverwaltung und ein
  neuer Abschnitt "Teams in diesem Verein" (Org-Admins sehen alle
  Teams ihres Vereins und können dort direkt ein neues, dem Verein
  zugeordnetes Team anlegen; einfache Mitglieder sehen weiterhin nur
  ihre eigenen Teams – Datensparsamkeit bleibt unverändert). Keine
  Backend-Änderung nötig, alles existierte bereits. Dabei behoben:
  `createTeam` schickte die gewählte Vereinszuordnung beim Anlegen
  eines Teams nie an die API – seither war die Verein-Auswahl im
  Anlege-Formular wirkungslos.
- Spieluhr: laufende Uhr mit Start/Pause/Drittel-Wechsel/Zurücksetzen
  direkt auf der Spielseite – überlebt einen Seiten-Reload (Zustand
  liegt auf dem Server, fünf neue Spalten auf `games`, kein Server-Tick
  nötig) und bleibt über mehrere Geräte/Tabs in Echtzeit synchron (über
  die bestehende, jetzt ressourcen-generische Presence-WebSocket-
  Infrastruktur, bisher nur für Boards). Bewusst mit den bestehenden
  Ereignis-Presets verknüpft: Start protokolliert automatisch einen
  Anstoß, ein Drittel-Wechsel automatisch ein Drittelende, als normale
  `game_events`-Zeile. Letzter, größerer Baustein von Phase C.
- Spielbericht: PDF-Export einer druckfreundlichen Zusammenfassung
  eines Spiels (Endstand, Ereignis-Zeitleiste, Match-Kader-Status)
  direkt auf der Spielseite, per pdfkit (gleiche Bibliothek wie der
  bestehende Trainingsplan-PDF-Export). Letzter kleiner Baustein von
  Phase C – nur die deutlich größere Spieluhr bleibt offen.
- Spieler-Statistiken (`/stats`, Fortsetzung Phase C): Tore,
  Strafminuten, Matchstrafen und Einsätze pro Kader-Spieler über alle
  Spiele hinweg – rein abgeleitet aus den bereits vorhandenen
  `game_events`/`game_squad`-Daten, keine neue Migration, keine
  zusätzliche Eingabe. Ein Tor ohne Zuordnung zählt fürs
  Team-Live-Ergebnis, aber für keinen einzelnen Spieler.
- Live-Spielstand: automatisch aus den bereits strukturierten
  Tor-Ereignissen berechneter Spielstand ("Wir 3 : 1 Gegner") direkt
  auf der Spielseite, kein eigenes Eingabefeld/Datenfeld nötig
  (Phase C, direkte Fortsetzung von "Live-Match-Ereignisse").
- Umfragen/Polls (schließt Roadmap-Phase D "Kommunikation – minimal"
  ab): Coach/Owner stellt eine Frage mit 2–10 Optionen (Einzel- oder
  Mehrfachauswahl) an sein Team unter `/polls`, Mitglieder stimmen ab,
  Ergebnisse sind sofort für alle sichtbar. Ein Klick auf die eigene
  Auswahl entfernt die Stimme wieder. Coach/Owner kann eine Umfrage
  schließen (verhindert weitere Stimmen). Neue `polls`/`poll_options`/
  `poll_votes`-Tabellen, gleiche `team_id NOT NULL`-Architektur wie
  `announcements`.
- News/Ankündigungen (Roadmap-Phase D "Kommunikation – minimal"):
  einfaches Team-Ankündigungsboard unter `/news` – Coach/Owner postet
  kurze Mitteilungen, alle Team-Mitglieder lesen sie chronologisch.
  Bewusst kein Vollchat (kein Kommentieren/Antworten). Neue,
  eigenständige `announcements`-Tabelle (`team_id NOT NULL`, kein
  persönlicher Fall – eine Ankündigung ohne Team hat kein Publikum).
- Live-Match-Ereignisse (Start Roadmap-Phase C "Match-Erlebnis"): die
  10 festen IFF-Preset-Buttons auf der Spielseite (Anstoß Drittel 1–3,
  Drittelende, Auszeit, Tor, Strafe 2/5 Min., Matchstrafe, Spielende)
  schreiben jetzt strukturierte Zeilen in eine neue `game_events`-
  Tabelle (Ereignistyp + Zuordnung auf Kader-Spieler/Gegner/keine
  Angabe) statt fertig zusammengesetzten Freitext in `comments` –
  Grundlage für spätere Statistiken (Tore/Spieler, Strafminuten).
  Freitext-Notizen bleiben unverändert über `comments` laufen, beide
  Quellen erscheinen gemeinsam in einer chronologisch sortierten
  Liste. Für den Trainer ändert sich an der Bedienung nichts. Bewusst
  noch ohne Live-Spielstand, Spieluhr oder Auswertung (folgt später).
- Serientermine für Trainingseinheiten: aus einer datierten
  Trainingseinheit heraus lassen sich Folgetermine (täglich/
  wöchentlich/alle 2 Wochen bis zu einem Enddatum, max. 52 pro
  Durchlauf) erzeugen. Jeder erzeugte Termin ist danach unabhängig
  editier-/löschbar (kein Serien-Tracking, keine Ausnahme-Verwaltung
  – bewusst einfacher gehalten als ein RFC-5545-RRULE-Modell). Das
  Anti-Abuse-Kontingent für Trainingseinheiten pro Nutzer wurde dafür
  von 20 auf 200 angehoben.
- ICS-Kalender-Abo (`/calendar`): persönlicher, wiederholt abrufbarer
  Kalender-Feed für Google Calendar/Apple Kalender/Outlook, gespeist
  aus datierten Spielen und Trainingseinheiten. Klartext-Token
  (`users.calendar_feed_token`, wie Share-/Invite-Links) statt
  gehashtem Token wie beim Passwort-Reset, da nur Lesezugriff auf
  Termine gewährt wird, nicht auf den Account selbst. Neuer,
  öffentlicher Endpunkt `GET /api/calendar-feed/:token.ics` (kein
  Auth, analog Share-/Einladungs-Links), Verwaltung
  (erzeugen/regenerieren/widerrufen) unter `/api/user/calendar-feed`.
  Hand-geschriebener RFC-5545-Generator ohne npm-Abhängigkeit
  (`backend/src/utils/ics.js`).
- Kalenderansicht (`/calendar`): Monatsraster zeigt Spiele und
  Trainingseinheiten gemeinsam an, farblich unterschieden, mit
  Monatsnavigation und "Heute"-Sprung. Reine Frontend-Arbeit auf den
  bereits vorhandenen Datumsfeldern (`games.playedAt`,
  `training_sessions.scheduledDate`) – kein neues Backend-Modell.
  Monats-/Wochentagsnamen über `Intl.DateTimeFormat` lokalisiert, keine
  neuen Übersetzungsstrings dafür nötig.
- Match-Kader für ein konkretes Spiel: pro Kader-Spieler festlegen, ob
  er spielt/Ersatz ist/verletzt ist/fehlt – unabhängig von Lines
  (spielübergreifende taktische Vorlage) und unabhängig von RSVP
  (Selbstauskunft der Account-Inhaber). Neue `game_squad`-Tabelle als
  echte Junction (wie `line_players`, mit direkten FKs auf Spiel und
  Kader-Spieler) statt polymorph wie `rsvps`/`comments` – dadurch
  räumt `ON DELETE CASCADE` automatisch auf, kein manueller
  Cleanup-Code nötig.

### Fixed
- Logo im Header war auf dunklen Themes, deren `--color-surface` nah
  am fest eingebrannten Navy-Ton des Logo-PNGs liegt (z. B. das "TB
  Uphusen Vikings"-Preset), kaum noch erkennbar. Ein fester,
  theme-unabhängiger weißer Hintergrund-Chip hinter dem Logo
  garantiert jetzt in jedem Theme ausreichenden Kontrast.

### Changed
- Neue Frames übernehmen Zeichnungen (Pfeile/Freihand) nicht mehr
  automatisch, nur noch die Spielerpositionen – ein neuer Frame ist
  meist eine neue Spielsituation, in der alte Pfeile selten noch
  passen. Über einen kleinen Schalter direkt neben dem
  "Frame"-Button in der Timeline lässt sich das bei Bedarf umkehren
  (z. B. für eine Zonenmarkierung, die über mehrere Frames gelten
  soll).

### Added
- RSVP/Anwesenheit für Spiele und Trainingseinheiten: bei einer
  team-geteilten Ressource sehen alle Team-Mitglieder die volle
  Team-Liste und können für sich selbst mit Zusage/Absage/Unsicher
  antworten (auch ohne Schreibzugriff auf die Ressource selbst – eine
  Selbstauskunft braucht keine Bearbeitungsberechtigung), bei einer
  Absage optional mit Grund (Schnellauswahl oder Freitext). Neue
  polymorphe `rsvps`-Tabelle (ein Status pro User+Ressource, Upsert)
  nach exakt demselben Muster wie die bestehende `comments`-Tabelle.

### Fixed
- Migration schlug auf einer komplett frischen Datenbank fehl ("relation
  teams does not exist") – die `lines`-Tabelle referenzierte `team_id
  REFERENCES teams(id)` inline in ihrem `CREATE TABLE`, obwohl `teams`
  erst deutlich später in der Migration angelegt wird. Betraf jede
  frische Self-Hosting-Installation und die CI (dort wird die
  Test-Datenbank immer frisch angelegt) – auf einer bereits
  migrierten Datenbank (z.B. dem laufenden Dev-Server) blieb es
  unbemerkt, da `CREATE TABLE IF NOT EXISTS` dort nichts mehr tat.
  `team_id` wird jetzt wie bei roster_players/playbooks/
  training_sessions/formation_templates per `ALTER TABLE` nach der
  `teams`-Tabelle ergänzt. Verifiziert gegen eine frisch angelegte
  Datenbank (kompletter Testlauf, 481/481 grün).
- "Position zurücksetzen"-Button im Spieler-Info-Panel des Board-Editors
  war seit dem Wechsel von `usePlayerState` auf `useDrawing` funktionslos
  (fehlende `onReset`-Prop) – Klick hat nichts ausgelöst. Jetzt wieder
  verdrahtet: setzt den ausgewählten Spieler per `movePlayer` (undo-bar)
  auf seine Standardposition aus `buildDefaultPlayers` zurück.

### Added
- GDPR-Backup-Export/Import (`/api/user/export`, `/api/user/import`) um
  Formationsvorlagen, Playbooks und Trainingspläne erweitert – bisher
  nur Boards, Kader und Lines. Boards referenzieren ihr Playbook beim
  Export über den Namen (nicht die ID, die beim Re-Import ohnehin neu
  vergeben wird), Trainingsplan-Einträge ihr Board über
  Name+Feldtyp+Erstellungszeitpunkt (derselbe Schlüssel, den der Import
  schon für die Board-Duplikaterkennung nutzt). Fehlt eine referenzierte
  Ressource beim Re-Import, wird die Zuordnung übersprungen statt einen
  Fehler zu werfen (wie schon bei fehlenden Kader-Referenzen in Lines).
  team_id bleibt wie bei Kader/Lines bewusst außen vor.
- Formationsvorlagen und Playbooks lassen sich jetzt umbenennen (bisher
  nur Anlegen/Löschen) – Doppelklick auf den Namen im
  Formationen-Tab des Board-Editors bzw. auf den Playbook-Chip auf
  `/boards`. Bewusst nur Umbenennen: Feldtyp/Spieler-Aufstellung einer
  Formation ändert man weiterhin durch Anlegen einer neuen Vorlage.
  Beide Ressourcen haben dafür ein `updated_at` erhalten und nutzen
  jetzt dieselbe Offline-Konflikterkennung wie Kader/Lines/Boards.
- Lines grundlegend auf den Kader umgestellt: eine Line ist jetzt eine
  taktische Zusammenstellung echter Kader-Spieler (`/lines`, neue
  eigenständige Seite), kein Board-internes Detail mehr. Ein Spieler
  kann in beliebig vielen Lines stehen (echte Many-to-Many-Beziehung
  über eine neue `line_players`-Junction-Tabelle, analog
  `team_members`/`board_collaborators`) – Hinzufügen zu einer zweiten
  Line entfernt ihn nicht aus der ersten, Entfernen aus einer Line
  lässt andere unberührt, Löschen eines Kader-Spielers räumt seine
  Zuordnungen in allen Lines automatisch auf (Kader-Spieler und Lines
  selbst bleiben dabei jeweils erhalten). Optional team-geteilt wie
  Kader/Spiele. Auf der [Spielseite](./docs/wiki/Live-Spielnotizen.md)
  erscheinen die Lines direkt über den Live-Notizen für einen
  schnellen Wechsel während des Spiels – Aktivieren postet automatisch
  eine Notiz ("Linienwechsel – Line 2"). GDPR-Export/Import
  (`/api/user/export`) um Kader und Lines als Top-Level-Felder
  erweitert (Kader-Spieler werden beim Re-Import über
  Name+Nummer+Rolle wiedererkannt, nicht über die alte ID). Zusätzlich
  im Board-Editor ein "Lines"-Tab (zwischen "Zeichnen" und
  "Formationen"): ein Klick überträgt die Namen/Nummern der
  Line-Spieler nach Rolle (TW/V/C/S) auf die Heimteam-Positionen des
  aktuellen Frames – Anlegen/Bearbeiten bleibt bewusst auf `/lines`.
- Live-Spielnotizen: neuer Bereich "Spiele" – ein Spiel (Gegner,
  Datum, optional team-geteilt) anlegen und während des laufenden
  Spiels schnelle, automatisch zeitgestempelte Notizen erfassen
  (großes Eingabefeld, für Bedienung im Stehen/mit einer Hand
  optimiert). Schließt den bisher unadressierten Backlog-Punkt
  "Erweiterung: Live-Unterstützung". Die Notizen selbst sind keine
  neue Tabelle, sondern nutzen die bestehende `comments`-Infrastruktur
  (resource_type='game') – identisches Muster wie Kommentare auf
  Boards/Trainingseinheiten, nur mit eigener, auf Geschwindigkeit
  ausgelegter Oberfläche statt der generischen Kommentar-Ansicht.
  Zusätzlich Vorlagen-Buttons für die reglementierten Spiel-Ereignisse
  nach IFF-Regelwerk (Anstoß je Drittel, Drittelende, Auszeit, Tor,
  Strafzeit 2/5 Min., Matchstrafe, Spielende) – ein Tap trägt die
  Notiz direkt ein, ohne tippen zu müssen. "Tor", "Strafzeit 2/5 Min."
  und "Matchstrafe" öffnen zusätzlich eine Zuordnungs-Auswahl aus dem
  Kader des Spiels PLUS "Gegner" (jedes dieser Ereignisse kann genauso
  das eigene Team wie den Gegner betreffen) oder "Ohne Angabe". Seit
  IFF-Regelwerk 2026 dürfen auch Torhüter Tore erzielen, die Auswahl
  filtert Rollen deshalb bewusst nicht.
- Manueller Backup-Trigger: "Jetzt ausführen"-Button im Admin-Bereich
  bei den automatischen Backups, löst denselben Job wie der Cron-Lauf
  sofort für alle Nutzer aus (`POST /api/admin/backup-run`) –
  unabhängig davon, ob automatische Backups aktiviert sind. Sinnvoll
  z. B. vor riskanten Wartungsarbeiten, ohne auf den nächsten
  planmäßigen Lauf warten zu müssen. Läuft bewusst synchron im
  Request (wie der Cron-Lauf selbst auch) statt über eine eigene
  Job-Queue – für die self-hosted Zielgruppe (einzelner Verein, keine
  tausenden Nutzer) wäre das unnötige Komplexität.
- Video → Taktik-Board: eine über den Video-Zeichnen-Werkzeugen
  angefertigte Überlagerung (Pfeile/Freihand) lässt sich per Klick
  ("Als Taktik-Board übernehmen") in ein neues, eigenständiges,
  weiter bearbeitbares Board überführen – bisher musste eine im Video
  markierte Taktik von Hand auf einem neuen Board nachgebaut werden.
  Übernommen werden bewusst nur die bereits gespeicherte Zeichnung
  (kein Video-Standbild – dafür gibt es im Projekt keinen
  Erfassungsmechanismus und es wäre auch nicht der eigentliche
  Mehrwert). Die Umrechnung von Video-Pixel- in Feld-Meter-Koordinaten
  läuft rein clientseitig (`videoElementsToBoardElements.js`), das
  neue Board übernimmt Feldtyp und Farben des Ursprungs-Boards. Keine
  Backend-Änderung nötig – reine Frontend-Orchestrierung der
  bestehenden Board-/Frame-Endpunkte (analog `cloneLibraryEntry`).
- Vertiefte Editor-Tour (Backlog-ISSUE 024, Ausbau der Onboarding-Tour
  aus ISSUE 023): zweite, unabhängige Spotlight-Tour direkt im
  Board-Editor – erklärt Spielerplatzierung, Zeichnen-Werkzeug,
  Szenen/Animation, automatisches Speichern und Export/Teilen. Nutzt
  dieselbe `tourStore.js`/`TourOverlay.jsx`-Grundlage wie die
  Nav-Tour (jetzt parametrisiert über `tourId`/`steps`/`settingsKey`
  statt fest verdrahtet) statt eines zweiten Tour-Frameworks. Eigener
  "gesehen"-Status (`editorTourCompleted`, getrennt von
  `tourCompleted`) – Überspringen/Abschließen der einen Tour
  beeinflusst die andere nicht. Startet einmal automatisch pro
  Account beim ersten Öffnen des Editors, jederzeit über ein
  Hilfe-Symbol im Editor erneut aufrufbar. Per Playwright komplett
  durchgespielt (alle 7 Schritte, automatischer Start, kein erneuter
  Auto-Start nach Reload, manueller Neustart über das Hilfe-Symbol).
- Passwort-Reset-Flow ("Passwort vergessen?" auf der Login-Seite):
  E-Mail-Link mit einmal verwendbarem, eine Stunde gültigem Token.
  Bewusst der einzige Token-Typ im Projekt, dessen Wert gehasht
  (SHA-256) statt im Klartext gespeichert wird (anders als Share-/
  Invite-Tokens) – Besitz erlaubt eine vollständige Account-Übernahme,
  ein DB-Leak darf das nicht automatisch mit-kompromittieren. Die
  Anfrage-Antwort ist für existierende und nicht-existierende
  E-Mail-Adressen identisch (keine Enumeration), ein neuer Request
  macht den vorherigen Token desselben Nutzers ungültig (immer nur
  ein aktiver Link). Erfordert konfigurierten SMTP-Versand (siehe
  Wiki, E-Mail-Versand) – ohne SMTP bleibt die Funktion ohne
  Fehlermeldung wirkungslos, analog zum bestehenden Board-Sharing-
  Mailversand.
- Automatisierte Backend-Tests für die Community-Bibliothek
  (`library.test.js`, 23 Tests) – bisher bestand hier eine Testlücke
  trotz produktivem Einsatz des Features.
- Onboarding-Tour für neue Nutzer (Backlog-ISSUE 023, CLAUDE.md §15
  "Einfach starten"): kurze, jederzeit überspringbare Spotlight-Tour
  (Willkommen → Boards → Trainings → Übungsbibliothek → Einstellungen
  → Fertig), die neuen Nutzern die wichtigsten Bereiche zeigt. Bewusst
  kurz gehalten (Progressive Complexity) – Kader/Wissen werden
  ausgelassen, um nicht mit jedem Nav-Punkt zu überfrachten. Läuft
  ohne neues Tour-Framework (kein intro.js/shepherd/reactour als neue
  Abhängigkeit) über einen leichtgewichtigen CSS-Spotlight-Trick;
  Persistenz des "gesehen"-Status läuft über die bereits bestehende,
  ungefilterte Settings-API (`preferences_json`) – keine neue
  Datenbank-Migration, kein neuer Endpunkt nötig. Startet automatisch
  beim ersten Login, ist per Escape/"Überspringen" jederzeit
  abbrechbar und lässt sich in Einstellungen → Darstellung über
  "Tour erneut starten" jederzeit wiederholen. Vollständig mit
  Tastatur bedienbar (Fokus-Falle, Escape) und kündigt jeden
  Schrittwechsel für Screenreader an (Accessibility First,
  CLAUDE.md §16).
- Offline-Konfliktlösung auf Trainingseinheiten und Kader-Einträge
  erweitert (bisher nur Boards/Frames): beide Ressourcen sind
  team-geteilt, zwei Co-Trainer können also real denselben Datensatz
  gleichzeitig bearbeiten. Bearbeitet ein Trainer offline eine
  Trainingseinheit oder einen Kader-Eintrag, während ein anderer
  Co-Trainer denselben Datensatz zwischenzeitlich online geändert
  hat, wird das beim Wiederverbinden erkannt (Vergleich von
  `updatedAt`) und im bestehenden "Sync conflicts"-Dialog angezeigt,
  statt die fremde Änderung stillschweigend zu überschreiben. Nutzt
  dieselbe, bereits bewährte Mechanik wie bei Boards vollständig mit
  (`frontend/src/utils/offlineSync.js`/`offlineQueue.js` bleiben
  unverändert – bereits ressourcen-agnostisch) – nur die beiden Hooks
  (`useTrainingSessions.js`, `useRoster.js`) übergeben jetzt
  `baselineUpdatedAt`/`conflictCheckUrl`/`label` beim Bearbeiten/
  Löschen. Voraussetzung für den Kader: `roster_players` hatte bisher
  kein `updated_at` und keinen Einzel-Endpunkt – beides ergänzt
  (`GET /api/roster/:id` als neue `conflictCheckUrl`, additive
  Migration mit Standard-Update-Trigger, kein Datenverlust für
  bestehende Einträge). Verifiziert mit zwei simulierten Co-Trainern
  im Browser (einer offline, einer ändert währenddessen denselben
  Datensatz online) sowie einer Gegenprobe ohne Fremdänderung (kein
  falsch-positiver Konflikt).
- KI-Trainingsassistent MVP (EPIC 010, `docs/planning/AI_SYSTEM.md`
  §5.1): neuer "Mit KI planen"-Button auf der Trainings-Seite (nur
  sichtbar, wenn diese Instanz einen KI-Anbieter konfiguriert hat).
  Trainer geben Altersgruppe (feste Liste, keine Freitext-Personen-
  daten), Trainingsziel, Schwerpunkt, Dauer und Spieleranzahl ein; die
  KI liefert einen Textentwurf (Warm-up/Technik/Taktik/Spielform/
  Cool-down mit Übungsideen und Coachingpunkten, Vorschlagscharakter
  statt Tatsachenbehauptungen), der vor dem Übernehmen editierbar ist
  und erst auf explizite Bestätigung als neue Trainingseinheit
  gespeichert wird (`notes`-Feld) – kein Auto-Save, keine automatische
  Board-Erzeugung. Architektur wie in `AI_SYSTEM.md` §3/§4 vorgesehen:
  austauschbarer Adapter für ein generisches OpenAI-kompatibles
  `/v1/chat/completions`-Schema (funktioniert mit selbst gehostetem
  Ollama/LM Studio/vLLM ebenso wie mit kommerziellen Anbietern),
  zentrale Prompt-Vorlage (`backend/src/services/ai/prompts/
  training.md`) statt im Code verstreuter Prompts, komplett optional
  – ohne Konfiguration ist der Button einfach nicht sichtbar, kein
  Fehlerzustand. Konfiguration (Basis-URL, Modell, Timeout, API-Key)
  läuft direkt über Einstellungen → Admin, ohne Server-Neustart
  (`app_config`-Tabelle, `AI_PROVIDER_*`-Env-Vars bleiben als Fallback
  für Erstinstallationen bestehen, DB-Werte haben Vorrang sobald ein
  Admin sie über die UI setzt). Der API-Key wird dabei nie an die UI
  zurückgegeben (nur ob einer gesetzt ist) – ein leer gelassenes Feld
  beim Speichern lässt ihn unverändert, ein Klick auf "Speichern" ohne
  Key-Eingabe kann ihn also nicht versehentlich löschen. Eigenes,
  engeres Rate-Limit für `/api/ai/training-plan` (10/15min). Mit einem
  selbstgeschriebenen Fake-OpenAI-Server im Browser durchgespielt
  (kompletter Pfad ohne echte KI-Kosten/Zugangsdaten): Konfiguration
  über die Admin-UI setzen → Formular → Generieren → editierbares
  Ergebnis mit Transparenz-Hinweis (Modellname) → Übernehmen → neue
  Trainingseinheit mit befülltem Text.
- KI-Taktikassistent & KI-Analyseassistent (EPIC 010, `AI_SYSTEM.md`
  §5.2/§5.3): zwei weitere Text-Assistenten auf der Boards-Seite, nach
  demselben bewährten Muster wie der Trainingsassistent (Formular →
  editierbarer KI-Entwurf mit Transparenz-Hinweis → explizites
  Übernehmen → neues Board mit dem Entwurf im `notes`-Feld, kein
  Auto-Save). Taktikassistent: Kategorie (Forechecking/Powerplay/
  Boxplay/Allgemein) plus kurze Frage, KI liefert 2–3 Varianten mit
  Vor-/Nachteilen (`category: 'taktik'`). Analyseassistent: Freitext-
  Beobachtungen zu einem Spiel/einer Situation, KI liefert Zusammen-
  fassung, erkannte Muster und Anschlussfragen für das nächste
  Training – ausdrücklich ohne Spielerbewertung
  (`category: 'spielverstaendnis'`). Da Beobachtungen Freitext sind
  und leicht Namen enthalten könnten, gibt es hier zusätzlich einen
  sichtbaren Datenschutz-Hinweis direkt unter dem Eingabefeld sowie
  eine explizite Prompt-Anweisung, Namen/Rückennummern in den
  Beobachtungen zu ignorieren und nie zu wiederholen. Beide nutzen die
  bestehende KI-Infrastruktur (Adapter, DB-Konfiguration über
  Einstellungen → Admin, eigene Rate-Limits) vollständig mit – keine
  neue Infrastruktur, nur zwei neue zentrale Prompt-Vorlagen
  (`backend/src/services/ai/prompts/tactics.md` /
  `analysis.md`) und zwei neue Endpunkte. Komplett mit Fake-KI-Server
  im Browser durchgespielt (Formular → Generieren → Übernehmen → neues
  Board mit korrekter Kategorie in der Liste).
- KI-Wissensassistent (EPIC 010, `AI_SYSTEM.md` §5.4 – letzter
  Baustein der KI-Bereiche): neue eigenständige Seite "Wissen", auf der
  Trainer in natürlicher Sprache nach bereits gespeichertem Vereins-
  wissen fragen können ("Welche Powerplay-Varianten haben wir
  gespeichert?"). Anders als die drei anderen KI-Assistenten kein
  Formular-zu-Entwurf-Modal, sondern eine reine Frage-Antwort mit
  Quellenangaben (klickbare Verweise zurück zu den gefundenen Boards/
  Trainingseinheiten) – nichts wird gespeichert oder übernommen.
  Retrieval bewusst ohne Vektor-/Embedding-Infrastruktur: einfache,
  parametrisierte `ILIKE`-Stichwortsuche über eigene Boards (inkl.
  geteilter), team-geteilte Trainingseinheiten und die instanzweite
  Bibliothek (`backend/src/services/ai/knowledgeRetrieval.js`) – reicht
  für die Datenmenge einer Vereinsinstanz und vermeidet eine neue
  KI-Anbieter-Abhängigkeit (CLAUDE.md 5.8 KI-Unabhängigkeit). Werden
  keine passenden Einträge gefunden, wird die KI gar nicht erst
  aufgerufen (kein Risiko einer erfundenen Antwort); die Quellenliste
  kommt direkt aus der Datenbank-Abfrage, nicht aus dem KI-Text. Die
  Seite bleibt in der Navigation sichtbar, auch ohne konfigurierten
  KI-Anbieter – erklärt dann transparent, warum die Funktion inaktiv
  ist, statt einfach zu verschwinden. Nutzt die bestehende KI-
  Infrastruktur vollständig mit (Adapter, DB-Konfiguration, Rate-
  Limit); komplett mit Fake-KI-Server im Browser durchgespielt
  (Frage mit Treffern → Antwort mit klickbaren Quellen → Navigation
  zum richtigen Board; Frage ohne Treffer → eigener Hinweistext ohne
  KI-Aufruf; ohne Konfiguration → erklärende Inaktiv-Karte).
- Community-Übungsbibliothek MVP (EPIC 010 – Backlog "Community und
  Ökosystem"): Trainer können ein Board über einen neuen "In Bibliothek
  veröffentlichen"-Button im Info-Tab des Editors als Übung mit der
  ganzen (self-hosted) Instanz teilen. Neue Seite `/library` (nur für
  eingeloggte Nutzer dieser Instanz, kein anonymer Zugriff wie bei
  `/share/:token`) mit Kategorie-Filter und Namenssuche; jeder Eintrag
  lässt sich als eigenes, voll editierbares Board übernehmen ("Add to
  my boards") oder melden. Veröffentlichen erzeugt bewusst eine
  SNAPSHOT-Kopie in einer neuen `library_entries`-Tabelle statt eines
  Live-Verweises auf das Board – `notes` (Trainervermerke) und
  `opponent` (Gegner-Name) werden dabei nie mitkopiert (Privacy by
  Design). Löscht der Ersteller später seinen Account, bleibt der
  Eintrag erhalten, nur die Autoren-Zuordnung wird anonymisiert
  (`owner_id` → `SET NULL`, Anzeige "Former member"). Moderation ist
  Post-Moderation statt Freigabe-Workflow: jeder Nutzer kann einen
  Eintrag einmal melden, Admins sehen gemeldete Einträge sortiert nach
  Meldungsanzahl unter Einstellungen → "Library reports" und können sie
  entfernen (Hard-Delete). Eigene Einträge lassen sich jederzeit selbst
  entfernen (Löschrecht). Mit zwei echten Test-Accounts im Browser
  durchgespielt: Veröffentlichen, Filtern/Suchen, Übernehmen (inkl.
  Zugriffsprüfung – nur Owner/Admin sieht den Entfernen-Button),
  Melden (keine Duplikate) und Admin-Entfernen funktionieren wie
  vorgesehen.
- UI/UX-Design-Review umgesetzt (alle 13 Punkte aus dem Design-Audit):
  Emoji-Icon-System vollständig auf `lucide-react` migriert (33 Dateien,
  betrifft praktisch jede Seite), gemeinsame `Button`-Komponente ersetzt
  37 unabhängig gestylte Buttons (behebt gemessene 36/44/48px-Höhen-
  Streuung und uneinheitliche Fokus-Ring-Stile), `SettingsPage.jsx`
  (1011 Zeilen) in sechs eigenständige Section-Komponenten mit echter
  Tab-Navigation aufgeteilt (Progressive Disclosure statt einer langen
  Formular-Wand), Board-Editor-Tab-Leiste bekommt Scroll-Fade +
  thematische Gruppierung (Bearbeiten/Medien/Info), eigenständige
  Display-Schrift (Oswald) für Überschriften statt überall derselben
  Fließtext-Schrift, neues `--color-info`-Token, Empty States mit
  Erklärung statt bloßem "nichts da" vereinheitlicht, Speicherstatus im
  Board-Header mit Icon+Farbe statt reinem Textwechsel. Neues Feature:
  eigenes Farbthema erstellbar (4 Farbwähler, alle übrigen Töne werden
  automatisch abgeleitet – siehe `deriveCustomThemeTokens()` in
  `utils/color.js`), rein persönliche Einstellung über die bestehende
  `settings.preferences_json`-Ablage, keine neue Backend-Tabelle nötig.
  Optische Seite (Icon-Look, Farbwähler-Vorschau, Tab-Optik) diesmal per
  echtem (headless) Browser gegen den laufenden Container geprüft –
  Boards-Empty-State, Settings-Tabs, Custom-Theme-Farbwähler und
  Board-Editor-Speicherstatus sehen wie vorgesehen aus.
- Mobile/Tablet-Touch-Optimierung (ROADMAP-Backlog): `touch-action: none`
  auf dem Spielfeld-Canvas (verhindert, dass Ziehen von Spielern/Zeichnen
  auf Touch-Geräten mit Seiten-Scroll/Pinch-Zoom kollidiert), Werkzeug-
  Leiste-Buttons von 40×40px auf 44×44px (Apple/Material-Mindestgröße für
  Touch-Targets) angehoben, Werkzeug-Leiste wird auf schmalen Bildschirmen
  (≤640px) zu einer horizontalen Leiste über dem Feld statt einer
  vertikalen Seitenleiste (Floorball-Feld sonst auf Handy-Portrait stark
  gequetscht). Ohne echtes Gerät zum optischen Gegentesten – strukturell
  verifiziert (Build/Tests grün), bitte auf einem echten Handy gegenchecken.
- Echtzeit-Präsenz MVP (ROADMAP-Backlog "Echtzeit-Co-Editing"): zeigt im
  Board-Header an, wer gerade dasselbe Board geöffnet hat ("👥 2 weitere
  Personen hier"). Neue WebSocket-Infrastruktur (`ws`-Paket,
  `services/presenceServer.js`, `/api/ws/presence`), nginx leitet
  Upgrade-Requests darüber bereits über die bestehende `/api/`-Location
  durch. Bewusst NICHT enthalten: Live-Cursor-Positionen, Konflikt-
  Auflösung bei simultanem Bearbeiten – beides bräuchte ein eigenes
  UX-Konzept, siehe `presenceServer.js`-Kommentar.
- Echtzeit-Co-Editing ausgebaut: die beiden zurückgestellten Teile der
  Präsenz-MVP sind jetzt da. Live-Cursor – die Mausposition anderer
  Personen erscheint sofort als farbiger Punkt mit Namen auf dem eigenen
  Spielfeld (gedrosselt über dieselbe Presence-WebSocket, keine neue
  Verbindung nötig). Echtes Live-Merging statt bloßem Konflikt-Hinweis –
  Spielerzüge und fertig gezeichnete Pfeile/Freihand-Elemente werden
  sofort an alle verteilt, die GERADE dasselbe Frame offen haben, nicht
  erst nach dem nächsten Autosave. `useDrawing.js` wendet empfangene
  Operationen über einen neuen `REMOTE_OP`-Reducer-Zweig an, bewusst OHNE
  die eigene Undo/Redo-Historie zu berühren – Strg+Z macht auf jedem
  Client immer nur die eigenen Aktionen rückgängig, nie eine fremde.
  Bewusst NICHT enthalten: Frame-Wechsel bleibt rein lokal (kein
  "Entführen" der Ansicht anderer), Punkt-für-Punkt-Streaming während
  einer laufenden Zeichen-Geste (Peers sehen ein Element erst fertig),
  Zustands-Snapshot für neu dazustoßende Mitbearbeiter (Basis ist der
  zuletzt autogespeicherte Stand, max. 30s alt), siehe
  `presenceServer.js`-Kommentar. Live mit zwei echten, parallelen
  Browser-Sessions (zwei Accounts, ein Board, Owner + Kollaborator)
  gegengecheckt: Präsenz-Badge, Live-Cursor-Punkt mit Namen und
  Live-Merge eines gezeichneten Pfeils kamen jeweils sofort und ohne
  Aktion der Gegenseite an.
- Video-Integration MVP (ROADMAP-Backlog): bis zu 5 kurze Videoclips pro
  Board hochladen (MP4/WebM/MOV, je max. 200MB), nativer Player mit
  Scrubbing (Range-Requests). Neuer Tab "🎥 Video" im Board-Editor.
  Bewusst NICHT enthalten: Zeichnen über dem Video, Schnitt/Trimmen,
  Szenen-Timeline – eigene, deutlich größere Ausbaustufen mit eigenem
  UX-Konzept, siehe `videoController.js`-Kommentar. Ablage auf Disk
  (neues `videos_data`-Volume), Dateien werden beim Board-Löschen (auch
  Soft-Delete) automatisch mitgelöscht.
- Video-Integration ausgebaut: die drei in der MVP zurückgestellten Teile
  sind jetzt da. Zeichnen über dem Video – eine feste Überlagerung pro
  Video (Video pausieren, mit denselben Zeichen-Werkzeugen wie im Board-
  Editor drüberzeichnen, Zeichnung bleibt fürs ganze Video sichtbar),
  bewusst kein zeitstempel-gebundenes Mehrfach-Annotationssystem. Trimmen
  – rein Player-seitige Start-/Endgrenzen, kein serverseitiger ffmpeg-
  Schnitt, Originaldatei bleibt immer vollständig erhalten und die Grenzen
  sind jederzeit zurücksetzbar. Szenen-Marken – Zeitstempel mit Label
  unter dem Player, Klick springt zur Position. Neuer PUT-Endpoint
  `/api/boards/:id/videos/:videoId` für partielle Updates (Zeichnung/Trim/
  Marken/Titel einzeln änderbar). Bei der Konva-Overlay-Optik bin ich wie
  beim Touch-Umbau ohne echten Browser unterwegs – strukturell verifiziert
  (Build/Tests grün), bitte selbst gegenchecken.
- Undo/Redo (Strg+Z / Strg+Y) deckt jetzt auch Spieler-Positionen ab –
  bisher war nur das Zeichnen (Pfeile, Freihand) rückgängig machbar,
  Spieler ziehen/per Pfeiltaste verschieben hatte gar keine Undo-
  Anbindung. `useDrawing.js` verwaltet Spieler und Elemente jetzt über
  einen gemeinsamen `useReducer`-Verlauf – Strg+Z macht immer die
  zeitlich letzte Aktion rückgängig, egal ob Zeichnung oder Spielerzug.
  Formation-Vorlagen laden ist ebenfalls undo-bar; Namensänderungen/
  Roster-Zuweisungen bewusst nicht (keine Taktik-Entscheidung). Zusätzlich
  zu den bestehenden Buttons in der Zeichnen-Werkzeugleiste jetzt auch
  ↩/↪-Buttons direkt im Board-Header, unabhängig vom aktiven Tab/Werkzeug
  immer sichtbar – nicht jeder kennt Strg+Z/Strg+Y.
- Fertige GIF-/MP4-Exporte lassen sich jetzt direkt über das native
  Teilen-Menü des Geräts verschicken (u.a. WhatsApp), über die
  Web-Share-API (`navigator.share`). Button erscheint nur, wenn der
  Browser die API unterstützt (v.a. mobil) – der normale Download-Link
  bleibt als Fallback immer bestehen (z.B. Desktop-Firefox).
- E-Mail-Einladungsflow für Board-Sharing: eine noch nicht registrierte
  Adresse bekommt jetzt statt eines 404-Fehlers eine Einladungsmail mit
  Link (`/invite/:token`, neue `board_invites`-Tabelle). Registriert sich
  die Adresse später (unabhängig davon, ob über den Link oder direkt),
  wird sie automatisch als Kollaborator zum Board hinzugefügt – kein
  Sonderfall im Registrierungsformular nötig. Bestehende
  Kollaborator-Verwaltung (`ShareBoardModal`) zeigt offene Einladungen
  mit "⏳ Eingeladen"-Badge, Berechtigung ändern/zurückziehen funktioniert
  identisch zu echten Kollaboratoren.
- Postkarten-Galerie-Miniatur zeigt jetzt die hinterlegte Taktik statt
  nur eines leeren Feldes: `GET /api/boards` liefert zusätzlich
  `players_json` (bewusst ohne `elements_json` – Freihand-Zeichnungen
  können groß werden, für die reine Übersicht nicht nötig),
  `FieldMiniature` zeichnet die Spielerpositionen als kleine Punkte in
  derselben 90°-Drehung wie das Feld.
- Optionaler SMTP-Mailversand (`backend/src/utils/mailer.js`,
  `nodemailer`): wird beim Hinzufügen eines Kollaborators (Issue #51)
  genutzt, um eine kurze Benachrichtigungsmail zu verschicken. Ohne
  `SMTP_HOST` bleibt die App unverändert voll funktionsfähig, es wird
  nur nichts verschickt – bewusst kein Zwang zur Mailserver-Einrichtung
  für Self-Hoster. Neue Env-Vars in `.env.example`/`docker-compose.yml`:
  `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`,
  `SMTP_PASSWORD`, `SMTP_FROM`.
- Gegner-Tagging: Boards können beim Anlegen oder im Editor-
  "Einstellungen"-Tab mit einem freien Gegner-Textfeld markiert werden
  ("vs. Team X"), sichtbar als Badge auf Kachel/Postkarte, durchsuchbar
  über ein neues Suchfeld in der Board-Übersicht.
- Einzel-Frame-Share: der aktuell aktive Frame lässt sich als PNG-Link
  ohne Login teilen (z. B. für WhatsApp), unabhängig vom vollen
  Board-Share-Link. Nutzt die in der `exports`-Tabelle bereits
  vorgesehene, aber nie implementierte `format='png'`-Option.
- Übungsbibliothek-Metadaten (OpenFloorball-Roadmap Phase 3): Boards
  lassen sich optional als Trainings-Übung einordnen – Kategorie
  (Technik/Taktik/Kondition/Spielverständnis/Nachwuchs), Altersklasse,
  Ziel und Material, editierbar im Editor-"Einstellungen"-Tab, in der
  Board-Übersicht nach Kategorie filterbar. Additive Spalten auf der
  bestehenden `boards`-Tabelle statt eines separaten Exercise-Modells.
- Erstes Vitest-Setup für das Frontend (bisher kein Test-Tooling
  vorhanden): Stores, `useShare`-Hook und i18n-Schlüsselparität
  zwischen `de.json`/`en.json` sind jetzt automatisiert getestet.
- **Team-Konzept** (ROADMAP Phase 2 – Team und Organisation): Teams mit
  drei Rollen (owner/coach/member), Mitgliederverwaltung per Einladung
  über eine bereits registrierte E-Mail-Adresse. Kader, Playbooks,
  Trainingspläne und Formations-Vorlagen lassen sich optional einem
  Team statt nur der eigenen Person zuordnen und sind dann für alle
  Team-Mitglieder sichtbar/nutzbar – Boards bleiben bewusst außen vor,
  die granularere Einzel-Freigabe (`board_collaborators`) deckt das
  bereits ab. Neue "Teams"-Sektion in den Einstellungen.
- **Kommentare** (ROADMAP Phase 2): auf Boards und Trainingseinheiten,
  jeweils als eigener Tab bzw. Abschnitt. Lesen/Schreiben braucht nur
  Lesezugriff auf die Ressource, Löschen darf der Autor selbst oder wer
  Schreibzugriff auf die Ressource hat (Moderation).
- **Automatische Board-Versionierung** (ROADMAP Phase 2): bei jedem
  Speichern entsteht automatisch ein Snapshot aller Frames, mit einer
  Obergrenze von 50 Versionen pro Board (Datensparsamkeit). Neuer
  "Verlauf"-Tab im Board-Editor: Zeitstempel-Liste + Wiederherstellen
  (sichert vorher selbst den aktuellen Stand, damit nichts verloren
  geht).
- **Vereins-Ebene** (ROADMAP Phase 2): ein Verein bündelt mehrere Teams
  rein organisatorisch (2 Rollen: admin/member) – teilt aber selbst
  keine Inhalte, Kader/Playbooks/Trainingspläne/Formationen bleiben wie
  gehabt team-gebunden. Vereins-Admins sehen zugeordnete Teams auch
  ohne eigene Team-Mitgliedschaft. Neue "Vereine"-Sektion in den
  Einstellungen.
- Team-Auswahl beim Anlegen von Playbooks und Formations-Vorlagen –
  Backend unterstützte `teamId` bereits, dem kompakten Chip-UI fehlte
  die Auswahlmöglichkeit (analog Kader/Trainingseinheiten).
- Datum und Ziel für Trainingseinheiten (ROADMAP Phase 3): die Roadmap
  nennt "Datum, Dauer, Ziel, Übungen" als Kernfelder – Dauer/Übungen
  waren über die Einheiten-Items bereits abgedeckt, Datum und Ziel
  fehlten im Datenmodell. Beide jetzt in der Detailseite editierbar,
  das Datum zusätzlich als Badge auf der Übersichts-Kachel.
- Slogan ("Weil Taktik mehr als nur Kreide an der Tafel ist.") unter
  dem Logo auf Login-/Registrierungsseite, plus eine zentrierte
  "Mit ❤️ für die Floorball-Community entwickelt"-Zeile im globalen
  Footer.
- Echtes OpenFloorball-Logo (Ball + Taktik-Klemmbrett) ersetzt den
  bisherigen "FF"-Platzhalter – als Browser-Tab-Favicon/PWA-Icon sowie
  auf Login-/Registrierungsseite. Verlustbehaftet komprimiert
  (pngquant) ohne sichtbaren Qualitätsverlust, relevant für den
  PWA/Offline-Modus in Hallen mit schlechtem WLAN (#49).
- Dasselbe Logo auch in der globalen Kopfzeile (bisher dort ebenfalls
  nur "FF"), damit auf jeder eingeloggten Seite sichtbar statt nur auf
  Login/Register. Der Slogan sitzt dafür im globalen Footer statt in
  der Kopfzeile – unter dem kleinen Logo in der schmalen, sticky
  Kopfzeile wirkte er gequetscht statt gut lesbar.
- Admin-Benachrichtigungsmail bei jeder Neuregistrierung (nur bei
  konfiguriertem SMTP), Text variiert zufällig zwischen mehreren
  augenzwinkernden Formulierungen statt immer derselben trockenen
  Meldung. Der erste Nutzer (wird automatisch Admin) bekommt keine Mail
  über die eigene Registrierung.
- Konfliktlösung für Offline-Sync bei mehreren Geräten (ROADMAP Phase 4):
  Frames (Taktik-Inhalt) haben jetzt wie Boards ein `updatedAt`. Gepufferte
  Offline-Änderungen an Frames/Boards werden vor dem erneuten Abschicken
  gegengeprüft – wurde die Ressource zwischenzeitlich auf einem anderen
  Gerät geändert, wird NICHT automatisch überschrieben, sondern als
  Konflikt markiert. Neuer Hinweis im Offline-Banner öffnet einen Dialog
  mit allen betroffenen Änderungen zur manuellen Prüfung/zum Verwerfen.
  Alle anderen puffer-fähigen Ressourcen (Teams, Kader, Kommentare, …)
  bleiben bewusst beim bisherigen Last-Write-Wins.

### Changed
- Lines waren bisher (Issue #12, v0.4.0) rein board-interne
  Hervorhebungs-Gruppen: sie gruppierten anonyme Platzhalter-Positionen
  EINES Board-Frames zur farblichen Hervorhebung auf dem
  Taktik-Diagramm, ohne jeden Bezug zum echten Kader
  (`roster_players`). Das entsprach nicht dem tatsächlichen
  Floorball-Konzept einer Line (laufende, unbegrenzte
  Spielerwechsel – eine Line ist eine wiederverwendbare Kombination
  echter Spieler, kein Board-Detail). Die alte Tabelle `lines`
  (`board_id` + `player_ids_json`) und die Board-Spalte
  `active_line_id` wurden ersetzt (nur 2 Zeilen betroffen, automatische
  Migration wäre ohnehin unmöglich gewesen, da die alten Einträge keine
  echte Spieler-Identität enthielten). Das Lines-Panel im Board-Editor
  (Tab zwischen "Zeichnen" und "Formationen") sowie die zugehörige
  Hervorhebung von Spieler-Tokens auf dem Feld entfallen ersatzlos –
  siehe "Added" für das neue Modell.
- Board-Editor: Gegner + Übungsbibliothek-Metadaten (Kategorie/Altersklasse/
  Ziel/Material) aus dem "Einstellungen"-Tab in einen umbenannten "Info"-Tab
  (vormals "Notizen") verschoben, zusammen mit den bestehenden Notizen
  (neue Komponente `BoardDetailsPanel`). Passt inhaltlich besser dorthin
  ("worum geht's bei diesem Board" statt Anzeige-/Verhaltens-Einstellungen)
  und macht nebenbei den Unterschied zu "Kommentare" klarer (Info = ein
  Dokument zum Board, Kommentare = Diskussions-Thread zwischen
  Kollaboratoren). "Einstellungen" enthält jetzt nur noch Namen/Hinweise/
  Feldtyp/Teilen.
- Board-Editor: rechtes Menü (Zeichnen-Koordinaten, Lines, Formationen,
  Export, PDF-Export, Notizen) von einer schmalen 220px-Seitenleiste in
  eine Tab-Leiste unter der Frame-Timeline verschoben – das Feld bekommt
  dadurch die volle Breite (neue Komponente `BoardSidePanelTabs`). Das
  Menü ist standardmäßig eingeklappt (nur die Tab-Leiste sichtbar) und
  klappt erst auf Klick auf, damit der Fokus auf dem Spielfeld bleibt
  statt auf einem dauerhaft großen Panel darunter.
- Board-Editor: Frame-Timeline (Frame 1, Frame 2, …) sitzt jetzt über
  dem Tab-Menü statt darunter.
- Board-Editor: "Namen anzeigen", Positions-Hinweise, Spielfeld-Typ und
  "Board teilen" aus dem Header-Menü heraus in einen eigenen
  "Einstellungen"-Tab im unteren Menü verschoben (neue Komponente
  `FieldSettingsPanel`, nutzt intern `FieldNamesBar`). Teamfarben und
  Tastaturkürzel bleiben bewusst im Header, da sie ohne Menü-Klick
  schnell erreichbar sein sollen. Die nun ungenutzte `FieldToolbar`
  wurde entfernt.
- Neun Dokument-Dopplungen in `docs/planning/` konsolidiert, dabei u.a.
  einen echten Inhaltsfehler behoben (`PRIVACY.md` enthielt
  Security-Konzept-Inhalte statt Datenschutz-Inhalten) und drei
  widersprüchliche Repository-Struktur-Vorschläge auf einen
  gemeinsamen, kanonischen Stand gebracht.

### Fixed
- Hauptnavigation auf schmalen Bildschirmen (Handy gemeldet): die
  Header-Nav-Leiste hatte kein eigenes Mobile-Layout und musste
  horizontal gescrollt/gewischt werden, um an hintere Links (Kader,
  Übungsbibliothek, Wissen, Einstellungen) zu kommen. `Header.jsx`
  bekommt jetzt unterhalb von 700px ein Hamburger-Menü (fokusfallen-
  gesichertes Dropdown-Panel statt horizontaler Leiste, 44px-Touch-
  Ziele, schließt automatisch bei Navigation/Escape/Klick daneben).
  `TourOverlay.jsx` musste dabei angepasst werden: sie sucht Tour-
  Zielelemente per `data-tour`-Attribut, das jetzt auf zwei Elementen
  gleichzeitig sitzt (Desktop-Leiste + mobiles Menü, je nach
  Bildschirmbreite ist nur eines sichtbar) – wählt jetzt gezielt das
  tatsächlich sichtbare Element statt blind das erste im DOM.
- Reload-Endlosschleife für nicht eingeloggte Erstbesucher auf einem
  neuen Gerät (u.a. auf dem Handy gemeldet): die neu eingeführte
  `TourOverlay.jsx` (Onboarding-Tour) rief unbedingt `useSettings()`
  beim Mounten auf – auch dann, wenn (noch) kein Nutzer eingeloggt
  war, da die Komponente bisher immer gemountet war, unabhängig vom
  Login-Status. Das dabei erwartete 401 auf `GET /api/settings` löste
  in `apiFetch.js` einen harten `window.location.href = '/login'`-
  Reload aus, selbst wenn man bereits auf `/login` war – jeder Reload
  hat denselben 401 erneut provoziert: Endlosschleife (dieselbe
  Fehlerklasse wie der `/auth/me`-Reload-Loop weiter unten, hier über
  einen neuen Pfad erneut aufgetreten). Behoben durch zwei Änderungen:
  `TourOverlay` wird in `App.jsx` jetzt nur noch gemountet, wenn ein
  Nutzer eingeloggt ist (`{user && <TourOverlay />}`), und `apiFetch.js`
  bekommt zusätzlich denselben `alreadyOnLogin`-Guard wie der
  Axios-Interceptor in `api.js` (siehe unten) – verhindert diese
  Fehlerklasse jetzt unabhängig davon, was den ersten unbeabsichtigten
  401 auslöst.
- Boards-Übersicht: drei vom `lucide-react`-Umzug übersehene Icons.
  Empty-State (vier gleiche Kästchen, `LayoutGrid`) wirkte für ein
  Taktikboard beliebig – jetzt `Presentation` (Whiteboard auf Ständer).
  Die beiden View-Toggle-Buttons (Postkarten-/Kompaktansicht) waren noch
  rohes Unicode (🃏/▦) statt Icon-Komponente, jetzt `Grid2x2`/`Grid3x3`.
- Reload-Endlosschleife für nicht eingeloggte Besucher, die direkt auf
  `/login` oder `/register` landen (also den normalen Haupteinstieg der
  App): `App.jsx` ruft `fetchMe()` bei jedem Seiten-Mount auf, auch auf
  diesen beiden öffentlichen Seiten. Der Axios-Interceptor in `api.js`
  hat auf das dabei erwartete 401 (nicht eingeloggt) bisher mit einem
  harten `window.location.href = '/login'` reagiert – ein kompletter
  Seiten-Reload selbst dann, wenn man bereits auf `/login` war, was
  `fetchMe()` erneut auslöst und so in eine Schleife aus Reloads läuft.
  Endet erst, wenn der allgemeine Rate-Limiter `/api/auth/me` mit 429
  blockt (auf das der Interceptor nicht reagiert). `/auth/me` ist jetzt
  wie `/auth/login`/`/auth/register` von diesem Redirect ausgenommen
  (ein 401 dort ist die normale "nicht eingeloggt"-Antwort, kein
  abgelaufenes Session-Cookie mitten in der Nutzung) – `authStore.
  fetchMe()` fängt den Fehler bereits selbst ab und setzt `user: null`,
  die bestehenden Route-Guards greifen dann ohne Reload. Zusätzliche
  Absicherung: kein Redirect mehr, wenn die aktuelle Seite bereits
  `/login` ist. Beim Live-Check des UI/UX-Reviews mit einem frischen,
  nicht eingeloggten Browser-Profil aufgefallen.
- GIF-/MP4-Export funktionierte über das echte Frontend nie (413
  "Payload Too Large"), obwohl die Live-Verifikation per curl zuvor
  erfolgreich aussah – lag an zwei unabhängigen Bugs, die sich mit
  winzigen Test-Bildern gegenseitig verdeckt hatten:
  1. `useExport.js` hängte `/api/export/...` an eine bereits `/api`
     enthaltende Basis-URL (`VITE_API_URL`) – Requests gingen an das
     nicht existierende `/api/api/export/...`.
  2. Selbst mit korrigierter URL: ein globaler `express.json({ limit:
     '10kb' })` in `server.js` konsumierte den Request-Body, bevor der
     `/export`-Sub-Router mit seinem eigentlich vorgesehenen 50mb-Limit
     überhaupt zum Zug kam – der Body kann nur einmal geparst werden.
     `/api/export/*` ist jetzt vom globalen Parser ausgenommen.
  3. Zusätzlich fehlte in der Nginx-Konfiguration `client_max_body_size`
     (Standard 1MB) – auch das hätte realistische Export-Anfragen
     unabhängig von 1./2. weiterhin blockiert, jetzt auf 50mb gesetzt.
- Helmet sendete unconditional einen `Strict-Transport-Security`-Header
  (HSTS, 1 Jahr, `includeSubDomains`). Läuft die Instanz hinter einem
  Reverse-Proxy/Tunnel, der HTTPS nicht zuverlässig terminiert (z.B.
  Dynamic-DNS-Tunnel-Dienste wie home64.de), zwingt der Browser die Seite
  nach dem ersten Aufruf dauerhaft auf HTTPS – führte zu endlosen
  Reload-/Redirect-Schleifen und Logins, die nach jedem Reload verloren
  gingen (Cookie unter dem erzwungenen Schema nicht wiedergefunden). HSTS
  ist jetzt an dieselbe `COOKIE_SECURE`-Weiche gekoppelt wie die
  Cookie-Optionen (`utils/cookies.js`) – wer `COOKIE_SECURE=false` setzt
  (Homelab ohne verlässliches TLS davor), bekommt bewusst kein HSTS.
  **Bereits im Browser gespeicherte HSTS-Regeln für die eigene Domain
  müssen einmalig manuell gelöscht werden** (Chrome:
  `chrome://net-internals/#hsts` → Domain löschen; Firefox: Website-Daten
  für die Domain löschen), da eine bereits akzeptierte Regel nicht allein
  durch das Fehlen des Headers zurückgesetzt wird.
- Gelöschte Boards gaben zuvor erzeugte Einzel-Frame-Share-Links
  (`/api/share/frame/:token`) weiterhin öffentlich frei – anders als der
  volle Board-Share-Link, der `deleted_at` bei jedem Aufruf korrekt prüft,
  fehlte dieser Check bei `getSharedFrame` komplett. Bild blieb bis zum
  natürlichen Ablauf (Standard 72h) abrufbar, obwohl das Board längst
  gelöscht war. Query prüft jetzt zusätzlich `boards.deleted_at IS NULL`.
- Export-Status-Polling (`useExport.js`, GIF/MP4) prüfte die Antwort des
  Status-Endpunkts nicht auf HTTP-Fehler – ging der Job serverseitig
  verloren (z.B. durch einen Backend-Neustart während eines laufenden
  Exports, da der Job-Store nur In-Memory existiert), lieferte
  `GET /api/export/status/:id` 404, `data.status` war `undefined`, traf
  weder den "done"- noch den "error"-Zweig, und die UI blieb ohne jede
  Fehlermeldung dauerhaft im "processing"-Zustand hängen. Zusätzlich
  wurde das Polling-Intervall beim Schließen des Export-Panels nie
  aufgeräumt und lief unbegrenzt im Hintergrund weiter, auch nach dem
  Unmounten der Komponente.
- Boards ließen sich in der Postkarten-Galerie-Ansicht nicht löschen –
  `BoardPostcard.jsx` hatte (anders als die Kachel-Ansicht `BoardCard.jsx`)
  gar keinen Lösch-Button/`onDelete`-Prop verdrahtet. Nachgerüstet nach
  demselben Muster (Eigentümer-Check, Klick öffnet `DeleteConfirmDialog`).
- Allgemeines `/api/`-Limit (100 Anfragen/15min) war für echte
  interaktive Nutzung zu knapp bemessen – `useAutoSave.js` debounced
  Speichern schon 300ms nach jeder Änderung (nicht nur alle 30s),
  aktives Verschieben von Spielern beim Taktik-Zeichnen feuert dadurch
  viele Requests pro Minute, dazu kommen mehrere API-Aufrufe pro
  Seitenwechsel und ggf. mehrere gleichzeitig aktive Nutzer hinter
  derselben IP. Ein frisch registrierter Nutzer konnte dadurch schon
  beim ersten Ausprobieren (Spielfeld anlegen) blockiert werden – wirkte
  wie eine fehlende Berechtigung, war aber ein zu enges Limit (keine
  Rollen-Beschränkung existiert im Code). Limit auf 500 angehoben.
- Registrierung wurde weiterhin vom allgemeinen `/api/`-Limit (100/15min)
  blockiert, obwohl sie längst ein eigenes, dediziertes Budget hatte –
  Express beendet die Middleware-Kette nicht, nur weil später im Code
  noch ein spezifischerer `app.use()` für denselben Pfad folgt. War das
  geteilte 100er-Budget durch normale App-Nutzung mehrerer Nutzer
  hinter derselben IP aufgebraucht, kam wieder die falsche "Zu viele
  Anfragen"-Meldung statt der eigentlich zutreffenden – exakt das
  Symptom des ursprünglichen Fixes darunter, nur über einen anderen
  Pfad. `/api/auth/login` und `/api/auth/register` sind jetzt vom
  allgemeinen Limiter ausgenommen.
- Getrennte Rate-Limiter für `/api/auth/login` und
  `/api/auth/register` statt eines gemeinsamen Budgets für den ganzen
  `/api/auth/`-Pfad: eine Registrierung (nach mehreren
  Validierungsfehlern) oder normale, bereits authentifizierte Aufrufe
  wie `/me` konnten das 10-Anfragen-Limit für Login mit ausschöpfen –
  die Fehlermeldung sagte dann fälschlich "Zu viele Login-Versuche",
  obwohl gar keine Login-Versuche stattgefunden hatten. Bei einer
  gemeinsam genutzten IP (Verein/Büro hinter einem NAT) reichte das oft
  schon durch einen einzigen Kollegen, um alle anderen mit
  auszusperren.
- Neues-Spielfeld-Dialog: fehlendes `max-height` ließ den Dialog bei
  viel Inhalt (Name, Gegner, Kategorie, 4 Feldtyp-Karten) höher werden
  als der Viewport – durch die vertikale Zentrierung rutschte der
  Header dabei über den sichtbaren Bereich hinaus. Jetzt wie bei den
  übrigen Dialogen auf 80vh begrenzt mit intern scrollendem
  Formularbereich, Header und Aktions-Buttons bleiben fix sichtbar.
  Abbrechen/Anlegen-Buttons füllen außerdem die volle Breite statt
  rechtsbündig zusammengedrängt zu wirken.
- Verwaiste Kommentare beim Account-Löschen: `boards.user_id` und
  `training_sessions.user_id` haben `ON DELETE CASCADE` auf `users` –
  beim Löschen eines Accounts (Selbstlöschung oder durch einen Admin)
  wurden dessen Boards/Trainingseinheiten dadurch hart gelöscht, ohne
  über `deleteBoard`/`deleteSession` zu laufen, wo die
  Kommentar-Aufräumung sitzt. Kommentare anderer Nutzer auf den
  gelöschten Ressourcen blieben dadurch als verwaiste Zeilen zurück, da
  `comments` bewusst kein DB-seitiges FK hat (polymorph über zwei
  Zieltabellen).
- Ersteller-Account-Löschung riss Team/Verein für alle mit:
  `teams.created_by`/`organizations.created_by` hatten `ON DELETE
  CASCADE`, obwohl beide Spalten reine Provenienz sind (nie an die API
  exponiert) – die eigentliche Berechtigung läuft über
  `team_members.role='owner'`/`organization_members.role='admin'`, die
  unabhängig davon geändert werden kann. Ein Nutzer konnte die
  Owner-/Admin-Rolle übertragen, die Gruppe komplett verlassen und
  Monate später seinen damit gar nicht mehr verbundenen persönlichen
  Account löschen – das komplette Team/den Verein riss es dann für alle
  verbleibenden Mitglieder mit. Jetzt wie `board_versions.created_by`
  korrekt `ON DELETE SET NULL`.
- Board-Editor: bei aufgeklapptem unterem Tab-Menü schrumpft der
  Feldbereich – die Zeichen-Werkzeugleiste (u.a. Linienstärke-Auswahl)
  und das Spieler-Info-Fenster (Namen eintragen) hatten kein eigenes
  Scrolling und wurden dadurch vom `overflow: hidden` des Feldbereichs
  teilweise unsichtbar abgeschnitten statt sich anzupassen. Beide
  scrollen jetzt intern, wenn der verfügbare Platz nicht mehr reicht.
- CI: `EXPORTS_DIR` im Backend-Testjob (`.github/workflows/ci.yml`) auf
  `/tmp/openfloorball-exports-ci` gesetzt statt des Produktions-Defaults
  `/app/exports`, der nur innerhalb des Docker-Containers beschreibbar
  ist – auf dem bare GitHub-Actions-Runner (non-root) führte das seit
  dem MP4-Export-Feature (Commit `b6a5a2e`) durchgehend zu `EACCES` in
  `POST /api/export/gif`/`mp4` und damit zu 3 fehlschlagenden Tests in
  `export.test.js`. Die produktive Docker-Umgebung war davon nie
  betroffen. (Erster Fix-Versuch nutzte `${{ runner.temp }}` – der
  `runner`-Kontext steht in einem Job-`env`-Block aber nicht zur
  Verfügung, was den gesamten Workflow ungültig machte; korrigiert
  auf einen literalen Pfad.) Nach Behebung des EACCES-Problems zeigte
  sich ein zweiter, unabhängiger Fehler: `ffmpeg` ist auf dem bare
  GitHub-Actions-Runner nicht vorinstalliert (nur im Docker-Image via
  `apk add ffmpeg`) – Backend-CI installiert jetzt `ffmpeg` +
  `fonts-dejavu-core` per `apt-get` vor den Tests; da Ubuntu die
  DejaVu-Schrift unter einem anderen Pfad als Alpine ablegt, wird sie
  zusätzlich nach `/usr/share/fonts/dejavu/` kopiert (exakter Pfad aus
  `WATERMARK_FONT` in `exportController.js`). Zusätzlich: verschluckte Fehlermeldungen in
  `exportController.js`/`backupCron.js` behoben (`err` statt
  `err.message` an den Logger übergeben – Winstons Format gibt einen
  reinen String-Zweitparameter sonst nicht aus), was die Diagnose
  unnötig erschwert hat.
- Gezeichnete Pfeile/Linien im Board-Editor gingen beim Wechsel des
  Frames verloren (#54): Autosave beobachtete bisher nur `livePlayers`,
  nicht `drawing.elements` – reines Zeichnen löste dadurch nie ein
  Speichern aus. Der anschließende Frame-Wechsel überschrieb den
  lokalen Zeichenstatus dann mit dem (noch leeren) gespeicherten Stand
  des neuen Frames. Autosave beobachtet jetzt beide zusammen, zusätzlich
  wird vor einem manuellen Frame-Wechsel explizit ein ausstehendes
  Speichern abgewartet, damit auch sehr kurz aufeinanderfolgende
  Aktionen (zeichnen → sofort Frame wechseln) nichts verlieren.

---

## [0.9.0] – 2026-08-04

Mit Abstand größtes Release bisher: 25 abgeschlossene Issues, sieben neue
Funktionsbereiche und eine vollständige Abhängigkeits-/Runtime-Modernisierung.

### Added
- **Formationen-/Startaufstellungs-Vorlagen-Bibliothek** (#46): Aufstellungen
  als wiederverwendbare Vorlage speichern, über alle Boards hinweg laden,
  automatische Neuskalierung bei abweichendem Feldtyp.
- **Playbooks** (#52): Boards zu benannten Sammlungen gruppieren (z. B. alle
  Standardsituationen einer Saison), Filter-Leiste in der Board-Übersicht.
- **Trainings-/Übungsplaner** (#45): Trainingseinheiten als geordnete
  Sequenz mehrerer Boards mit Dauer/Notiz je Übung, eigener PDF-Export für
  den kompletten Trainingsplan.
- **Zentraler Team-Kader** (#53): Spieler mit Name/Rückennummer/Position
  einmal anlegen, im Board-Editor per Dropdown zuweisen statt Freitext –
  rein additiv, Board-Spieler bleiben weiterhin frei editierbar.
- **PWA/Offline-Modus** (#49): Service Worker cacht App-Shell + zuletzt
  gesehene Board-Daten; Schreibzugriffe werden bei Verbindungsabbruch in
  einer IndexedDB-Queue gepuffert und beim Wiederverbinden automatisch
  synchronisiert (Last-Write-Wins). Global sichtbarer Offline-Banner.
- **Board-Sharing** (#51, reduziertes MVP): Boards mit anderen Nutzern
  teilen (Lese-/Schreibzugriff), Kollaboratoren-Verwaltung im Editor.
  Bewusst ohne Echtzeit-Sync/WebSocket – siehe ROADMAP für die volle,
  zurückgestellte Ausbaustufe.
- Tastaturkürzel-Übersicht (Hilfe-Overlay) + sichtbarer Undo/Redo-Verlauf
  statt nur Einzelschritt (#47, #48)
- Zeichenwerkzeuge (Linien/Pfeile/Freihand) per Koordinaten-Formular
  vollständig tastaturbedienbar (#38, WCAG 2.1.1)
- TLS/HTTPS-Beispiel mit Caddy (`docker-compose.tls.yml`) (#39)
- Dedizierte Tests für Frames-/Lines-CRUD-Endpunkte (#44)

### Changed
- Stürmer stehen bei Anstoß jetzt korrekt in der eigenen Hälfte (vorher
  exakt vertauscht); Löschbestätigung für Boards von drei auf einen
  Bestätigungsschritt reduziert
- Standard-Aufstellung wird jetzt sofort beim Anlegen eines Boards gesetzt
  (serverseitig, transaktional) statt erst client-seitig nachzuladen;
  Auto-Speicherung von 2s auf 300ms Debounce beschleunigt
- Marken-Redesign: neue globale Kopfzeile mit Sprachauswahl-Button
  (Deutsch/Englisch), sportlichere Eigenmarke bei unverändertem
  Vikings-/IFF-Theme
- Spielfeld-Rendering IFF-korrekt überarbeitet: Anspielpunkte statt
  Mittelkreis (Floorball nutzt keinen Mittelkreis), Torraum-Abstand zur
  Bande (bespielbarer Raum hinter dem Tor), grüne statt fußballtypische
  Spielfläche
- `/boards` ist jetzt die direkte Startseite nach Login/Registrierung
  statt einer separaten Zwischenseite (siehe Removed)
- **Vollständige Abhängigkeits- und Runtime-Modernisierung** (5 Phasen,
  jede einzeln verifiziert und committed):
  - Backend: Express 4→5, redis-Client 4→6 (RESP3-Default), archiver 7→8
    (ESM-Rewrite, `ZipArchive`-Klasse statt Factory-Funktion), dotenv
    16→17, express-rate-limit 7→8, jest 29→30, eslint 9→10
  - Frontend: zustand 4→5, konva 9→10 (`Konva.legacyTextRendering = true`
    gesetzt, um das bisherige Text-Rendering pixelgenau zu erhalten),
    i18next 23→26, react-i18next 14→17
  - Infrastruktur: Node 20/22→24 (Active LTS) in allen Dockerfiles + CI,
    nginx 1.27→1.30, **Postgres 16→18** (Live-Migration der
    Produktivdatenbank per pg_dump/pg_restore in ein neues Volume –
    Postgres-Datenverzeichnisse sind zwischen Majors nicht kompatibel,
    altes Volume bleibt als Fallback erhalten), Redis-Server 7→8, alle
    GitHub Actions auf aktuelle Major-Versionen
  - Bewusst zurückgestellt: Vite 7→8 + `@vitejs/plugin-react` 5→6
    (ungelöster Peer-Konflikt mit einer Pre-Release-Version von
    `@babel/core` im Rolldown-Ökosystem), ESLint 10 im Frontend
    (`eslint-plugin-react` unterstützt aktuell nur `eslint ^9.7`)

### Fixed
- Fünf Dependency-Sicherheitslücken behoben (#32), u. a. bcrypt→tar-Kette
- Vite 5→7 + `@vitejs/plugin-react` aktualisiert – Sicherheitslücke im
  esbuild-Dev-Server geschlossen (#34)
- react-router v8 + React 19 – CSRF-Bypass-Lücke GHSA-qwww-vcr4-c8h2
  geschlossen (#35)
- `JWT_SECRET` wird beim Start jetzt auf Vorhandensein und Mindestlänge
  geprüft, statt stillschweigend mit einem schwachen Wert zu starten (#40)
- Line konnte nicht mehr losgelassen werden, sobald man mit dem Zeichnen
  einer Linie/eines Pfeils begonnen hatte (Konva-Hit-Testing-Bug)
- `<html lang>` wird jetzt synchron mit der UI-Sprache gehalten (#0849a5d,
  WCAG 3.1.1) – Screenreader lasen sonst mit falschen Ausspracheregeln vor
- Team-Farben (`homeColor`/`awayColor`) wurden beim Speichern kaputt
  persistiert (#33)
- Positions-Bezeichnungen an den tatsächlichen Floorball-Standard
  angepasst statt Eishockey-Terminologie (#28)
- Weißer Text auf weißem Button im Vikings-Theme
- Datenschutzerklärung ergänzt: Backup-Aufbewahrungsfristen nach
  Kontolöschung waren nicht dokumentiert (#41)
- **archiver v8**: ESM-Rewrite ohne Default-Export brach den
  Account-Export/Backup-Cron kommentarlos – auf die neue `ZipArchive`-API
  umgestellt
- **nginx-Cache-Regel**: Service-Worker-Datei (`sw.js`) wurde von der
  generischen Static-Asset-Regel fälschlich 1 Jahr lang gecacht, was
  PWA-Updates nie beim Client hätte ankommen lassen
- **Postgres-18-Image**: neue Mount-Konvention (`/var/lib/postgresql`
  statt `.../data`) erkannt und Compose-Konfiguration entsprechend
  angepasst, bevor produktiv migriert wurde

### Security
- Datensparsamkeit in Logs: keine E-Mail-Adressen/Klarnamen mehr in
  Log-Statements, wo eine User-ID zur Nachverfolgung ausreicht; Log-Datei
  mit Größen-/Rotationsgrenze versehen
- Ungenutzte DB-Spalte `exports.file_path` entfernt (#42, Datensparsamkeit)
- Kein persistenter Admin-Audit-Trail eingeführt – als nicht notwendig
  bewertet, da Alleinbetrieb (#43, geschlossen als „wontfix")

### Removed
- **Dashboard-Seite** entfernt (reine Begrüßungs-/Zwischenseite ohne
  Eigenwert) – `/boards` ist jetzt die direkte Startseite. Das
  Statistik-Widget (#50, „Statistiken zu genutzten Formationen/Lines")
  wurde mitentfernt, da es ausschließlich auf dem jetzt entfernten
  Dashboard angezeigt wurde; ebenso der zugehörige Backend-Endpunkt
  `GET /api/user/stats`, um keinen toten Code zu hinterlassen.

---

## [0.8.0] – 2026-08-02

### Added
- **MP4-Video-Export** via FFmpeg, wahlweise mit Wasserzeichen (#23)
- **PDF-Taktikblatt-Export** via pdfkit, mehrere Frames pro Seite (#24)
- **Mehrsprachigkeit**: Englisch als zweite Sprache (i18n vollständig) (#25)

### Fixed
- Vite 5→7 + `@vitejs/plugin-react` – esbuild-Dev-Server-Sicherheitslücke
  geschlossen (#34)
- react-router v8 + React 19 – CSRF-Bypass-Lücke GHSA-qwww-vcr4-c8h2 (#35)
- `<html lang>`-Attribut wird bei Sprachwechsel synchron gehalten (WCAG 3.1.1)

---

## [0.7.0] – 2026-08-02

### Added
- **Barrierefreiheit Teil 1** (#19): Skip-Links, Fokus-Management,
  vollständige Tastaturnavigation, Formularmuster/-validierung
- **Barrierefreiheit Teil 2** (#19): Screenreader-Live-Ankündigungen,
  Legasthenie-freundliche Schrift (OpenDyslexic), Farbblindheits-Modi
- **DSGVO-Konformität** (#20): Datenschutzseite, Auskunftsrecht Art. 15,
  IP-Anonymisierung in Logs
- **Backup & Export** (#21): manueller Datenexport/-import (ZIP) +
  automatische, konfigurierbare Admin-Backups mit Aufbewahrungsfrist
- **Datenvernichtung** (#22): Account inkl. aller Daten löschen, mit
  E-Mail-Bestätigung

### Fixed
- Positions-Bezeichnungen an den Floorball-Standard angepasst (#28)
- Datensparsamkeit: keine E-Mail-Adressen in Logs, Log-Größenbegrenzung

---

## [0.6.0] – 2026-08-01

### Added
- **Team-Farben**: Heim-/Auswärtsfarbe + Ballfarbe konfigurierbar,
  IFF-konforme Farbpalette (#14)
- **Einstellungsseite** (`/settings`) mit Passwort ändern, E-Mail ändern,
  Account löschen (#18, #17, #31, #22)
- **Admin-Panel**: Benutzerverwaltung für den ersten registrierten
  Account (automatisch Admin) (#26)
- Dashboard-Redesign: personalisierte, zentrierte Begrüßungsseite
  *(in v0.9.0 wieder entfernt, siehe dort)*

### Fixed
- Team-Farben (`homeColor`/`awayColor`) wurden beim Speichern kaputt
  persistiert (#33)
- Weißer Text auf weißem Button im Vikings-Theme
- Fünf Dependency-Sicherheitslücken behoben (#32)
- Dashboard verlinkte fälschlich nicht zu den Spielfeldern

---

## [0.5.0] – 2026-08-01

### Added
- **GIF-Export** via FFmpeg, serverseitig gerendert aus Konva-Offscreen-PNGs (#15)
- **Share-Link mit Ablaufzeit**: Spielzug ohne Login ansehen, konfigurierbare
  Gültigkeitsdauer (#16)
- Positions-Hinweise/Tooltips für jede Spielerposition, tastaturzugänglich (#27)

### Fixed
- Export: Backend-Absturz durch fehlende ffmpeg-Installation im
  Produktions-Image behoben

---

## [0.4.0] – 2026-08-02

### Added
- **Lines-System** (Issue #12): Sturm-/Defensivreihen anlegen, Spieler zuweisen,
  Farben & Typ (offense/defense/special) konfigurieren, aktive Line auf dem
  Feld hervorheben. Max. 10 Lines pro Board.
- **Spielfeld-Varianten** (Issue #13): Kleinfeld (20×14m), 3v3 (22×11m) und
  Street Floorball (25×15m) zusätzlich zum Großfeld, wählbar bei Board-
  Erstellung und nachträglich im Editor änderbar (mit Warnung + proportionaler
  Neuskalierung bestehender Positionen/Zeichnungen)
- Automatisches Seeding feldtyp-passender Standardpositionen für neue Boards

### Fixed
- Login/Register: CORS-Origin-Mismatch bei Zugriff über LAN-IP behoben
- Session-Cookie wurde mit `Secure`-Flag über reines HTTP ausgeliefert und
  vom Browser verworfen (neu: `COOKIE_SECURE` konfigurierbar)
- Axios-Interceptor leitete bei jedem 401 sofort zum Login um – auch beim
  Login/Register-Request selbst, wodurch Fehlermeldungen sofort verschwanden
- Fehlende i18n-Keys (`auth.*`, `a11y.skipToContent`) auf Login/Register-Seite
- Zeichen-Werkzeugleiste (`DrawingToolbar`) war nirgends eingebunden –
  Farbe/Strichstärke/Undo/Redo/Clear waren über die UI nicht erreichbar
- Spielerpositionen wurden beim Ziehen nicht an die Feldgrenzen geklemmt
- Docker-Healthchecks (Compose + Dockerfiles) nutzten `localhost`, was durch
  IPv6-Auflösung in Alpine-Containern fälschlich als "unhealthy" galt

---

## [0.3.0] – 2026-08-01

### Added
- **Frame-System** (Issue #10)
  - `FrameSchema` als Sub-Document im Board-Modell: Felder `order`, `label`, `players`, `elements`, `duration`
  - `framesController.js`: 5 REST-Endpunkte (GET, POST, PUT, DELETE, Reorder)
  - `frames.js` Router mit express-validator Validierung
  - Max. 50 Frames pro Board (server- und clientseitig erzwungen)
  - `useFrames.js` Hook: vollständiges State-Management (CRUD, Reihenfolge, aktiver Frame, goNext/goPrev, optimistisches Reorder + Rollback)
  - `FrameTimeline.jsx`: Timeline-Komponente am unteren Spielfeldrand
    - Drag & Drop zum Sortieren
    - Hover-Delete (× Button)
    - „+ Frame“ Button
    - Frame-Zähler (1 / 5)
    - Barrierefreiheit: aria-label, aria-pressed, aria-live
  - `FrameTimeline.module.css`: vollständiges Styling mit CSS-Variablen
- **Board Model** (Issues #5, #7, #10)
  - `notes`-Feld ergänzt (max. 500 Zeichen) für Coach-Notizen
  - `frames[]` Sub-Array für Frame-by-Frame System
  - `activeFrameIndex` persistiert
  - `lines[]` Sub-Schema für Lines-System vorbereitet
- **Animation** (#11): Play/Pause/Stop, Geschwindigkeit einstellbar,
  Spieler-Interpolation zwischen Frames
- **Postcard-Galerie** (#30): Board-Übersicht als Postkarten
  (Spielfeld-Miniatur links, Notizen rechts, nur lesbar in der Galerie)
- Spielername auf Spielertoken anzeigen, Line-abhängig ein-/ausblendbar (#29)

---

## [0.2.0] – 2026-08-01

### Added
- `FloorballField.jsx`: IFF-konformes 2D Großfeld mit Konva.js
  - Alle IFF-Linien: Mittellinie, Mittelkreis (r=2.85m), Torraum (4×5m)
  - Torwartfläche (2.5×1m), Tore (160×115cm), abgerundete Ecken
  - Theme-aware Farben (dark / light / vikings / iff)
- `FieldContainer.jsx`: responsiver Wrapper mit ResizeObserver
- `fieldConfig.js`: alle IFF-Maße als Konstanten (Groß-, Kleinfeld, Street, 3v3)
  - IFF-Ballfarben-Definitionen
  - Standard-Spielerpositionen Großfeld
  - Snapping-Raster-Optionen
- `useField.js`: Hook für Spielfeld-State (Typ, Grid, Zoom)
- `FieldContainer.module.css`: Shimmer-Ladeanimation
- i18n Locale-Dateien: `de.json` + `en.json` (vollständig)
- CSS Design-Tokens: alle 4 Themes (dark, light, vikings, iff)
- CI-Workflows repariert: fehlende Dateien, ESLint-Configs, Jest-Setup
- `index.html` + `main.jsx` als Vite-Einsteigspunkte
- `base.css` + `tokens.css` als CSS-Grundlage

### Fixed
- `dependency-review.yml`: nur noch auf Pull Requests (nicht push)
- `security.yml`: cron-Syntax korrigiert
- `release.yml`: `workflow_dispatch` als Trigger ergänzt
- `label-sync.yml`: `continue-on-error` bei Permission-Fehlern
- `ci.yml`: Cache-Key und `npm install` statt `npm ci`
- ESLint-Configs für Frontend (JSX) und Backend (Node.js Globals)
- Jest-Config für native ES Modules

---

## [0.1.0] – 2026-07-31

### Added
- Backend-Grundstruktur: Express.js, Helmet, CORS, Morgan, Rate-Limiting
- JWT-Authentifizierung (Register, Login, Refresh, Logout)
- PostgreSQL-Datenbankschema: `users`, `settings`, `boards`, `frames`, `lines`, `exports`
- Redis-Session-Management
- Docker Compose: backend, frontend, postgres, redis, nginx
- Nginx-Reverse-Proxy-Konfiguration
- GitHub Repository-Struktur: Labels, Issue-Templates, Milestones
- Automatisierte Workflows: CI, Release, Security, Dependency Review, Label Sync
- CHANGELOG, Wiki, Roadmap
- `.env.example` für alle Services
- Seed-Skript mit Demo-Admin und Demo-Board
- AI-Slop-Hinweis + Ideengeber-Klausel in README
