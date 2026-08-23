# BACKLOG.md

# OpenFloorball Coach Platform

## Entwicklungs-Backlog

---

# Arbeitsprinzip

Jede Aufgabe wird nach folgenden Kriterien bewertet:

Priorität:

* P0 = unverzichtbar für MVP
* P1 = wichtig nach MVP
* P2 = spätere Erweiterung
* P3 = Zukunftsidee

Jede Aufgabe benötigt:

* klare Beschreibung
* technische Überlegungen
* Akzeptanzkriterien

---

# EPIC 001 – Projektfundament

## Ziel

Eine stabile Entwicklungsgrundlage schaffen.

Priorität:

P0

---

# ISSUE 001

## Repository erstellen

### Beschreibung

Einrichtung der Projektstruktur.

---

## Aufgaben

Erstellen:

* Repository
* README
* CLAUDE.md
* Dokumentationsstruktur
* Lizenzdatei

---

## Akzeptanzkriterien

* Projekt kann lokal gestartet werden
* Dokumentation vorhanden
* Entwicklungsregeln definiert

---

# ISSUE 002

## Entwicklungsumgebung

### Aufgaben

Einrichten:

* TypeScript
* Linter
* Formatter
* Testing Framework
* Build System

---

## Akzeptanzkriterien

Ein Entwickler kann das Projekt nach Anleitung starten.

---

# ISSUE 003

## Designsystem Grundstruktur

### Aufgaben

Erstellen:

* Farben
* Typografie
* Buttons
* Dialoge
* Grundkomponenten

---

## Anforderungen

Design muss unterstützen:

* Desktop
* Tablet
* Touch

---

# EPIC 002 – Floorball Field Engine

## Ziel

Das digitale Spielfeld.

Priorität:

P0

---

# ISSUE 004

## Floorballfeld rendern

### Beschreibung

Darstellung eines offiziellen Floorballfeldes.

---

## Anforderungen

Unterstützen:

* Linien
* Tore
* Zonen
* Mittellinie

---

## Akzeptanzkriterien

Das Feld wird korrekt dargestellt.

---

# ISSUE 005

## Spielfeldinteraktion

### Aufgaben

Unterstützen:

* Zoom
* Verschieben
* Touch-Gesten

---

## Akzeptanzkriterien

Nutzung auf Tablet möglich.

---

# EPIC 003 – Spieler-System

## Ziel

Spielerobjekte verwalten.

Priorität:

P0

---

# ISSUE 006

## Spielerobjekt erstellen

### Eigenschaften

* Position
* Farbe
* Nummer
* Name
* Teamzugehörigkeit

---

# ISSUE 007

## Spieler bewegen

Unterstützung:

* Drag & Drop
* Snap Funktionen optional

---

# ISSUE 008

## Spielergruppen

Unterstützung:

* eigene Mannschaft
* Gegner
* Torhüter

---

# EPIC 004 – Taktikobjekte

## Ziel

Trainer können Situationen zeichnen.

Priorität:

P0

---

# ISSUE 009

## Laufwege

Unterstützen:

* Linie
* Richtung
* Farbe
* Geschwindigkeit

---

# ISSUE 010

## Passwege

Unterstützen:

* Start
* Ziel
* Ballbewegung

---

# ISSUE 011

## Schüsse

Unterstützen:

* Richtung
* Ziel
* Markierung

---

# ISSUE 012

## Zonen und Markierungen

Unterstützen:

* Rechtecke
* Kreise
* Freihand
* Text

---

# EPIC 005 – Szenen und Animation

## Ziel

Taktische Abläufe erklären.

Priorität:

P0

---

# ISSUE 013

## Szenensystem

Eine Taktik besteht aus mehreren Szenen.

---

## Beispiel

```text
Szene 1:
Aufstellung

Szene 2:
Bewegung

Szene 3:
Abschluss
```

---

# ISSUE 014

## Timeline

Minimal:

* Start
* Pause
* Ende

---

# ISSUE 015

## Animationssteuerung

Unterstützen:

* Wiederholung
* Geschwindigkeit

---

# EPIC 006 – Speicherung

## Ziel

Taktiken dauerhaft speichern.

Priorität:

P0

---

# ISSUE 016

## Datenmodell implementieren

Objekte:

* Tactic
* Scene
* Player
* Movement

---

# ISSUE 017

## Lokale Speicherung

Unterstützung:

* Browser Storage
* IndexedDB

---

# ISSUE 018

## Export und Import

Formate:

* JSON
* PNG
* PDF

---

# EPIC 007 – UX Qualität

Priorität:

P0

---

# ISSUE 019

## Trainerfreundliche Oberfläche

Prüfen:

* wenige Klicks
* klare Navigation
* verständliche Begriffe

---

# ISSUE 020

## Accessibility

Prüfen:

* Tastatur
* Kontrast
* Screenreader
* Touch

---

# EPIC 008 – Qualität

Priorität:

P0

---

# ISSUE 021

## Tests

Erstellen:

* Unit Tests
* Integration Tests
* UI Tests

---

# ISSUE 022

## Performance

Prüfen:

* Rendering
* Speicher
* Animation
* mobile Geräte

---

# ISSUE 023

## Onboarding-Tour für neue Nutzer

### Beschreibung

Ein neuer Nutzer soll ohne Schulung schnell verstehen, wie die
wichtigsten Bereiche der Plattform funktionieren (Taktikboard
anlegen, Trainingsplanung, Übungsbibliothek, KI-Assistenten) –
passend zu CLAUDE.md Kapitel 15 "Einfach starten".

### Aufgaben

* Kurze, jederzeit überspringbare Schritt-für-Schritt-Tour beim
  ersten Login (Hinweis-Overlay auf zentrale UI-Elemente: Neues
  Board erstellen, Trainingsplanung, Übungsbibliothek,
  Einstellungen).
* Erneuter Aufruf der Tour über die Einstellungen möglich – kein
  einmaliges Erlebnis, das man verpasst hat.
* Speicherung eines minimalen "Tour gesehen"-Status pro Nutzer
  (Datensparsamkeit, CLAUDE.md 5.1 – keine neue Tabelle nötig).

### Technische Überlegungen

* Kein externes Tour-Framework mit Telemetrie/Cloud-Abhängigkeit
  (Open Source First) – eigene, leichte Overlay-Komponente oder eine
  kleine, selbst gehostete Open-Source-Bibliothek ohne Tracking.
* Muss mit dem bestehenden i18n-System (de/en) funktionieren.
* Kein Pflichtschritt, der die Nutzung blockiert (keine Dark
  Patterns, CLAUDE.md 5.11).

### Akzeptanzkriterien

* Ein neu registrierter Nutzer sieht beim ersten Login automatisch
  die Tour.
* Die Tour lässt sich jederzeit überspringen/abbrechen.
* Ein bestehender Nutzer kann die Tour über die Einstellungen erneut
  starten.
* Tour ist per Tastatur bedienbar und mit Screenreader nutzbar
  (Accessibility First, CLAUDE.md 16).

Priorität:

P1

---

# ISSUE 024

## Vertiefte Editor-Tour: Spielfeld-Erstellung erklären

### Beschreibung

Feedback nach dem ersten Live-Einsatz von ISSUE 023: die Einführungs-
tour zeigt bisher nur, WO die wichtigsten Bereiche liegen (Nav-Links),
erklärt aber nicht, WIE man z.B. ein Taktikboard tatsächlich anlegt
und benutzt ("wie erstelle ich das, was ist wofür"). Sinnvolle
Erweiterung: eine zweite, tiefere Tour-Ebene direkt im Board-Editor,
die die konkreten Werkzeuge erklärt statt nur die Navigation.

### Aufgaben

* Eigene, optionale Editor-Tour (getrennt von der Nav-Tour aus
  ISSUE 023), die beim ersten Öffnen eines neu erstellten Boards
  startet – erklärt z.B.: Spieler platzieren/verschieben, Laufwege/
  Passwege zeichnen, Szenen anlegen und wechseln, Abspielen/Animation,
  Speichern, Teilen.
* Gleiches Muster wie ISSUE 023 wiederverwenden (Spotlight auf
  Werkzeugleiste/Editor-Elemente, jederzeit überspringbar, Fokus-
  Falle, Screenreader-Ankündigungen) – kein zweites Tour-Framework,
  dieselbe `tourStore.js`/`TourOverlay.jsx`-Grundlage erweitern statt
  parallel etwas Neues zu bauen.
* Erneuter Aufruf ebenfalls über die Einstellungen (oder direkt aus
  dem Editor über ein Hilfe-Icon) möglich.
* Eigener "gesehen"-Status getrennt von der Nav-Tour (z.B.
  `editorTourCompleted` neben `tourCompleted` in `preferences_json`).

### Technische Überlegungen

* Editor-Werkzeuge sind komplexer als Nav-Links (Canvas-Elemente statt
  einfacher DOM-Buttons) – Zielelemente brauchen ggf. eigene
  `data-tour`-Attribute auf der Werkzeugleiste statt auf Canvas-
  Objekten selbst.
* Reihenfolge/Inhalt der Schritte sollte sich eng an CLAUDE.md Kapitel
  10 (Virtuelles Taktikboard) orientieren (Drag & Drop, Layer-System,
  Animation Engine, Vorlagen).

### Akzeptanzkriterien

* Ein Nutzer, der zum ersten Mal ein Board öffnet, bekommt optional
  eine kurze Erklärung der wichtigsten Editor-Werkzeuge.
* Jederzeit überspringbar, erneut aufrufbar, tastatur- und
  screenreader-bedienbar (wie ISSUE 023).
* Nav-Tour (ISSUE 023) und Editor-Tour sind unabhängig voneinander
  – Überspringen/Abschließen der einen beeinflusst die andere nicht.

Priorität:

P2

---

# ISSUE 025

## Gegnerische Spieler nicht automatisch auf dem Feld platzieren

### Beschreibung

Beim Anlegen eines neuen Boards (`boardsController.js` →
`buildDefaultPlayers`) sowie beim Zurücksetzen/Wechseln des Feldtyps
im Editor (`usePlayerState.js` → `buildDefaultPlayers`) werden aktuell
automatisch sowohl die eigene Mannschaft ("home") als auch eine
vollständige gegnerische Aufstellung ("away") auf dem Feld platziert.
Das entspricht nicht dem typischen Trainer-Workflow: die meisten
Taktiken (Spielaufbau, Systeme, Trainingsformen) betreffen zunächst
nur die eigene Mannschaft. Feedback: die gegnerischen Spieler sollen
nicht automatisch auf dem Feld stehen.

---

## Aufgaben

* Default beim Anlegen eines neuen Boards/beim Zurücksetzen: nur
  eigene Mannschaft ("home") + Ball platzieren, keine "away"-Spieler.
* Zusätzlich (Feedback-Erweiterung): pro Spieler einzeln ein-/
  ausblendbar machen, nicht nur pauschal die ganze gegnerische
  Mannschaft. D.h. jeder Token (Home wie Away) bekommt eine
  Sichtbarkeits-Option statt nur "Gegner an/aus" als Gruppe – z.B. ein
  Kontextmenü-Eintrag "Ausblenden" pro Spieler-Token plus eine
  Übersicht/Liste im Editor (ähnlich Layer-Panel, CLAUDE.md Kapitel
  10.2), über die ausgeblendete Spieler gezielt wieder eingeblendet
  werden können.
* Ausgeblendete Spieler bleiben im Datenmodell erhalten (nur
  `visible: false`/ähnlich), keine Löschung – sonst gehen Name/
  Zuordnung beim Wiedereinblenden verloren.
* Bereits gespeicherte Boards nicht verändern (betrifft nur den
  Default für neue Boards/Resets).
* Frontend (`fieldConfig.js` → `buildDefaultPlayers`) und Backend
  (`defaultPositions.js` → `buildDefaultPlayers`) synchron halten
  (bestehender Duplikations-Hinweis in beiden Dateien beachten).

---

## Technische Überlegungen

* Beide `buildDefaultPlayers`-Implementierungen
  (`frontend/src/constants/fieldConfig.js`,
  `backend/src/constants/defaultPositions.js`) müssten um einen
  Parameter erweitert werden (z.B. `includeAway = false`) statt away
  hart einzubacken.
* Sichtbarkeit pro Spieler ist ein neues Feld im Player-Objekt (z.B.
  `visible`, Default `true` für home, `false` für away) – wirkt sich
  auf Rendering (Feld), nicht auf Drag&Drop/Positions-Logik aus.
  Bestehende Boards ohne dieses Feld müssen als "sichtbar" gelten
  (Fallback `visible !== false`), damit alte Frames unverändert
  aussehen.
* `usePlayerState.resetPlayer`/`resetAllPlayers` nutzen dieselbe
  Funktion für "Zurücksetzen" – Verhalten sollte konsistent bleiben
  (kein Zurücksetzen, das plötzlich Spieler wieder einblendet, die
  bewusst ausgeblendet wurden, außer der Nutzer wählt das aktiv).
* Frame-Animation/Versionierung beachten: Sichtbarkeit ist Teil des
  Frame-Zustands, muss also pro Szene mit animiert/gespeichert werden
  können, nicht nur global pro Board.
* Kein Datenmodell-Wechsel bei `team` nötig – `team: 'away'` existiert
  bereits, es geht nur um den initial befüllten Default plus die neue
  Sichtbarkeits-Option pro Spieler.

---

## Akzeptanzkriterien

* Ein neu angelegtes Board zeigt initial nur die eigene Mannschaft
  (+ Ball), keine gegnerischen Spieler.
* Jeder einzelne Spieler (Home wie Away) lässt sich unabhängig
  ein-/ausblenden, nicht nur die gegnerische Mannschaft als Ganzes.
* Ausgeblendete Spieler lassen sich über eine Übersicht gezielt
  wieder einblenden, ohne sie neu anlegen zu müssen.
* Bestehende, bereits gespeicherte Boards mit Gegnern sind von der
  Änderung nicht betroffen (alle Spieler weiterhin sichtbar).
* Feldtyp-Wechsel/"Alle zurücksetzen" platziert ebenfalls keine
  Gegner automatisch.

Priorität:

P1

---

# ISSUE 026

## GDPR-Backup-Export um Spiel- und Trainings-Domäne erweitern

### Beschreibung

`exportUserData.js` (genutzt von `GET /api/user/data` – Art. 15
Auskunft – und `GET /api/user/export` – ZIP-Backup) deckt aktuell
Boards, Kader, Lines, Playbooks, Formationsvorlagen und
Trainingspläne ab, aber weder die gesamte Spiel-Domäne
(`games`/`game_events`/`game_squad`/`match_lines`, EPIC 012 Phase 1–4)
noch die mit Statistik-Architektur Phase 5 neu hinzugekommenen
Trainings-Anwesenheit (`training_attendance`) und
Spielerentwicklungsnotizen (`player_development_notes`). Datenschutz-
und Auskunftsrecht sollten den vollen Datenbestand eines Accounts
abdecken (CLAUDE.md §5.2/§5.3 – Datenportabilität, Recht auf Auskunft).

---

## Aufgaben

* `buildUserExport` um eine `games`-Sektion erweitern (analog
  `trainingSessions`: eigene Spiele mit `game_events`/`game_squad`/
  `match_lines`, Referenzierung per Name/Datum statt DB-ID wie beim
  bestehenden Muster).
* Trainingspläne-Sektion um `attendance` je Session erweitern
  (Kader-Spieler-Referenz per Name+Nummer, analog `lines`-Export).
* Kader-Sektion um `developmentNotes` je Spieler erweitern (nur vom
  exportierenden Nutzer selbst verfasste Notizen).
* `importAccount` entsprechend erweitern, damit ein Re-Import nichts
  von alledem stillschweigend verwirft.
* Bestehende Backup-Format-Version (`BACKUP_FORMAT`) prüfen, ob eine
  neue Versionsnummer nötig ist oder additive Felder ausreichen.
* Die Datenkategorien-Liste auf `/privacy`
  (`frontend/src/pages/PrivacyPage.jsx`,
  `privacyPage.dataCategories.*`) nennt bisher nur Konto/Boards/
  Einstellungen – Kader, Spiele, Trainingsdaten (inkl. der neuen
  Trainings-Anwesenheit/Spielerentwicklungsnotizen) fehlen dort
  komplett. Gehört zum selben Auskunfts-/Transparenz-Thema wie der
  Export oben, sollte gemeinsam nachgezogen werden statt Einzelfelder
  isoliert zu ergänzen.

---

## Technische Überlegungen

* Games/game_events sind der größere, unabhängige Teil dieser Lücke –
  existierte bereits vor Statistik-Architektur Phase 5 und sollte
  gemeinsam mit der neuen Trainings-Anwesenheit/-Notizen nachgezogen
  werden, nicht isoliert (siehe Anmerkung in
  `docs/planning/STATISTICS_ANALYTICS_ARCHITECTURE.md` Abschnitt 8.7).
* Live-Spielstand/Statistiken sind aus `game_events` abgeleitet
  (`statisticsEngine.js`) – ein Re-Import müsste nur die Rohereignisse
  zurückspielen, nicht abgeleitete Werte.

---

## Akzeptanzkriterien

* Art. 15-Auskunft (`GET /api/user/data`) enthält alle personenbezogenen
  Daten des Accounts, inklusive Spiele und Trainings-Anwesenheit/
  -Notizen.
* Ein ZIP-Export lässt sich in einen neuen Account re-importieren,
  ohne dass Spiele, Anwesenheit oder Entwicklungsnotizen verloren
  gehen.

Priorität:

P2

---

# EPIC 009 – Nach MVP

Priorität:

P1

---

## Teamfunktionen

* Accounts
* Teams
* Rollen
* Teilen

---

## Trainingsplanung

* Übungen
* Einheiten
* Kalender

---

## Synchronisation

* Offline Sync
* Cloud Sync
* Konfliktlösung

---

# EPIC 010 – Zukunft

Priorität:

P2/P3

---

## Videoanalyse

* Clips
* Markierungen
* Taktiklayer

---

## KI-Assistent

* Trainingsvorschläge
* Taktikvarianten
* Analysehilfe

---

## Community

* Bibliotheken
* Vorlagen
* Austausch

---

# EPIC 011 – Vereinsebene als Koordinationsschicht

Priorität:

P3

Status: alle drei ursprünglich geplanten Bausteine umgesetzt.
Vereins-Dashboard zeigt eine gebündelte, admin-only Übersicht
anstehender Spiele+Trainings aller Teams des Vereins (2026-08-10,
`GET /api/organizations/:id/schedule`, rein lesend). Vereinsweit
geteilte Playbooks (2026-08-22, `playbooks.organization_id`, nur
Vereins-Admins dürfen anlegen, sichtbar für jedes Mitglied irgendeines
Teams des Vereins – siehe `docs/wiki/Playbooks.md`). Org-Admin-
Übersicht "wer ist wo Trainer" (2026-08-22,
`GET /api/organizations/:id/coaches`, admin-only, rein lesend).
"Vereinsweit geteilte Übungsbibliothek" bewusst NICHT als Erweiterung
der bereits bestehenden, instanzweit ÖFFENTLICHEN Community-Bibliothek
(`library_entries`, EPIC 010) umgesetzt – das wäre eine andere,
breitere Sichtbarkeit gewesen als "nur dieser eine Verein" und hätte
das bereits ausgelieferte öffentliche Feature riskant vermischt.
Playbooks (Board-Sammlungen) waren der bereits etablierte, strukturell
passende Träger für "geteilt, aber nicht öffentlich".

---

## Ausgangslage

Organizations (Vereine) sind bisher rein verwaltend: mehrere Teams
einem Verein zuordnen, Admin/Member-Rollen, aber kein geteilter Inhalt
über Teams hinweg. Diskussion (2026-08-09): Trainer-Alltag bleibt der
Kern der Plattform, aber ein Verein mit mehreren Sparten (z.B. 1.
Herren, U15, U18) braucht zusätzlich eine dünne
Koordinationsschicht **über** den einzelnen Teams, ohne sich Richtung
generisches Vereinsverwaltungs-Tool zu entwickeln (Finanzen,
Mitgliederverwaltung, Registrierung bleiben bewusst außerhalb, siehe
Roadmap-Audit "Phase Z" für die dort schon geprüften, nicht
empfohlenen Punkte).

---

## Mögliche Bausteine

* Vereins-Dashboard: Termine/Spiele aller Teams eines Vereins
  gebündelt (nur Lesen, kein neuer Bearbeitungsweg)
* Vereinsweit geteilte Übungsbibliothek/Playbooks – optional zusätzlich
  zu `teamId`, analog zum bestehenden Muster
* Org-Admin sieht Team-übergreifend, wer wo Trainer ist (Übersicht,
  kein automatisches Bearbeitungsrecht an Team-Inhalten)

---

## Abgrenzung (bewusst NICHT Teil dieses Epics)

* Finanzen/Mitgliedsbeiträge/Rechnungen
* Mitgliederregistrierung/Formulare/Waiver
* Turniere/Ligen zwischen mehreren Vereinen

---

# EPIC 012 – Statistik- und Performance-Analytics-Plattform

Priorität:

P1 (Fundament), einzelne Ausbaustufen P2-P3

---

## Ausgangslage

Diskussion (2026-08-10): OpenFloorball soll langfristig eine
ernstzunehmende Floorball-Statistik- und Performance-Analytics-
Plattform werden, nicht nur Team-Management. Vollständige Audit-,
Gap-Analyse- und Zielarchitektur liegt vor:

👉 **[docs/planning/STATISTICS_ANALYTICS_ARCHITECTURE.md](./STATISTICS_ANALYTICS_ARCHITECTURE.md)**

Kernprinzip: DATA FIRST, EVENTS FIRST, ANALYTICS SECOND, UI THIRD –
zuerst ein erweiterbares Match-Event-Datenmodell, dann Statistiken
darauf aufbauen, keine Statistik-Insel-Lösungen. Siehe ADR-0001 in
`DECISIONS.md` für die zentrale Architekturentscheidung
(Event-Typ-Definitionstabelle statt starres Enum).

---

## Phasen (Kurzfassung, Details im Architektur-Dokument)

> Phasenplanungs-Review 2026-08-21 (nach Abschluss Phase 6): Reihenfolge
> und Fundament bestätigt, keine Umstrukturierung nötig. Phase 7 im
> Zuschnitt präzisiert, Phase 8/9 um je eine zuvor implizite
> Voraussetzung ergänzt. Details/Begründung siehe Gesprächsverlauf
> dieses Datums bzw. die aktualisierten Abschnitte in
> `STATISTICS_ANALYTICS_ARCHITECTURE.md`.
>
> Stand 2026-08-22: Phasen 1–9 vollständig umgesetzt (xG v1/Shot Quality
> aus Phase 8 bewusst ausgenommen, siehe dort – No-Go mangels
> Datenbasis, kein Scope-Abbau). Das ursprünglich für EPIC 012 geplante
> Fundament ist damit fertig; einzige bewusst nicht enthaltene, künftige
> Erweiterung ist die Gegner-Entität (siehe unten).

1. Erweiterbares Event-Modell + zentrale Statistics Engine (Fundament) – ✅ umgesetzt
2. Match-Line/Shift-Tracking (Time on Floor, Line-Statistiken) – ✅ umgesetzt
3. Shot Tracking + Shot Map + Torhüter-Basis-Statistiken – ✅ umgesetzt
4. Special Teams, Situations-Splits, Spieler-Vergleich – ✅ umgesetzt
5. Trainings-Analytics/Spielerentwicklung (separate Domäne) – ✅ umgesetzt
6. Video↔Event-Verknüpfung – ✅ umgesetzt
7. Assists (Vorlauf, s.u.) + Custom Events/Tags + CSV-Export – ✅
   umgesetzt (ADR-0006). Ersetzt das zuvor vage "Report Builder"-Ziel
   durch einen konkret abgrenzbaren CSV-Export (Saison-Kennzahlen +
   Spiele/Endstände) – ein freier Report-Baukasten hätte ohne
   konkreten Use Case unbegrenzten Scope riskiert. Bewusst KEIN
   zusätzlicher JSON-Export: dieselben Daten sind über
   `GET /api/roster/stats`/`GET /api/games` bereits vollständig
   maschinenlesbar verfügbar (CLAUDE.md §5.3 Digitale Souveränität war
   damit schon erfüllt) – CSV ist der tatsächlich fehlende, in
   Excel/Sheets direkt nutzbare Mehrwert.
8. Advanced Analytics – Line-Chemie ✅ umgesetzt (2026-08-22,
   Saison-Aggregation über die bereits bestehende `calculateLineStats`,
   `/lines`). Datenbasis-Check für xG durchgeführt: 0 Spiele/
   game_events in allen geprüften Instanzen dieser Umgebung – **No-Go**,
   xG v1/Shot Quality bleiben zurückgestellt, bis reale Nutzungsdaten
   vorliegen (verhindert erfundene Präzision, CLAUDE.md-Pflicht). Bei
   Bedarf jederzeit erneut prüfbar, sobald echte Saison-Daten existieren.
9. KI/ML-Grundlagen – ✅ umgesetzt (2026-08-22). "Spiel-Insights"
   (`POST /api/ai/game-insights`, AI_SYSTEM.md §5.5) baut wie geplant
   auf der bestehenden KI-Provider-Abstraktion aus EPIC 010
   (`aiController.js`/`getAiProvider()`) auf statt einer neuen
   KI-Anbindung. Eingabe sind ausschließlich bereits berechnete
   Team-Aggregate (Schuss-/Special-Teams-/Situations-Statistiken),
   keine Rohereignisse, keine Personendaten – Grundlage über "Grundlage
   anzeigen" im UI einsehbar (Explainable AI).

**Vorlauf vor Phase 7 – Assists (✅ umgesetzt):** `game_events.secondary_roster_player_id`
existiert bereits seit Phase 1 für genau diesen Zweck, `docs/statistics.md`
dokumentiert die Formel seit Phase 1 als "möglich, noch nicht
ausgewertet" – aber keine der Phasen 1–9 hatte je eine Assist-UI als
Aufgabe zugewiesen. Kleine, in sich abgeschlossene Ergänzung (kein
neues Schema): Zweitspieler-Auswahl beim Tor-/Schuss-Erfassen +
`points = goals + assists` zur Anzeigezeit.

**Bewusst nicht Teil dieser Phasen (P2, künftiges, separates
Backlog-Item):** eine strukturierte Gegner-Entität (`opponents`-Tabelle
statt Freitext auf `games.opponent`) samt Saison-/Wettbewerbs-Gruppierung
von Spielen. Fachlich näher an der Spielverwaltung (`games`) als an der
Statistik-Engine – wurde deshalb bewusst nicht künstlich als Phase 10
in diese Epic aufgenommen, obwohl CLAUDE.md §8 "Gegneranalyse" für
Leistungszentren/Nationalteams nennt. Sichtbar dokumentiert statt
stillschweigend vergessen, siehe `STATISTICS_ANALYTICS_ARCHITECTURE.md`
Abschnitt 8.4.

---

## Abgrenzung

* Kein erfundenes xG ohne Datenbasis (CLAUDE.md-konform).
* Kein Ersatz für Trainer-Entscheidungen (Human First, §5.9).
* Keine Hockey-Geometrie 1:1 übernehmen – floorball-eigene
  Zonen-Definitionen.
* Kein freier "Report Builder" ohne konkreten Use Case (Review
  2026-08-21) – stattdessen fester, aber vollständiger CSV-Export
  (ADR-0006).

---

# Entscheidungsregel

Bei jedem neuen Issue prüfen:

1. Unterstützt es Trainer?
2. Passt es zur Architektur?
3. Ist Datenschutz gewährleistet?
4. Ist es die einfachste Lösung?
5. Kann es modular umgesetzt werden?

---

# Ende Backlog

OpenFloorball Coach wird Schritt für Schritt aufgebaut.

Qualität vor Geschwindigkeit.

Nachhaltigkeit vor kurzfristigen Features.
