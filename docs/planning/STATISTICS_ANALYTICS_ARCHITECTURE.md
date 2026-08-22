# STATISTICS_ANALYTICS_ARCHITECTURE.md

# OpenFloorball Coach Platform

## Statistik- und Performance-Analytics: Bestandsaufnahme, Gap-Analyse, Zielarchitektur

> Status: Analyse abgeschlossen (2026-08-10). Phase 1–6 umgesetzt (siehe
> Roadmap-Tabelle in Abschnitt 11 für Details je Phase); Phase 7–9 noch
> offen. Dieser Absatz wurde bei früheren Phasen nicht konsequent
> mitgepflegt – Einzelheiten je Phase daher **immer** über die
> Roadmap-Tabelle prüfen, nicht über diesen einleitenden Absatz. Alle
> weiteren Abschnitte noch NICHT implementiert außer explizit als
> "umgesetzt" markiert. Dieses Dokument ist die kanonische Quelle für
> die Statistik-/Analytics-Domäne und wird mit jeder Phase
> fortgeschrieben (siehe `docs/planning/DECISIONS.md` ADR-0001 für die
> zentrale Architekturentscheidung, ADR-0002/0003 für Phase 3).

---

# 1. CURRENT STATE

OpenFloorball ist heute eine funktionsfähige Team-Management- und
Taktikboard-Plattform mit rudimentärer, aber ehrlicher
Live-Spielnotizen-Funktion. Es gibt **keine** dedizierte
Statistik-/Analytics-Architektur – was existiert, ist als Nebenprodukt
der "Live-Spielnotizen"-Funktion (game_events) entstanden, nicht als
eigenständig entworfenes Datenmodell.

Kernaussage vorweg (siehe Abschnitt 6 für die Details): Das
Fundament – ein saubereres, erweiterbares `MatchEvent`-Modell – fehlt.
Alles, was heute an Statistik sichtbar ist, ist direkt aus einem sehr
schmalen, starren 7-Spalten-Event-Modell abgeleitet. Das ist der
richtige Ausgangspunkt (Events als Rohdaten, nicht redundante
Zählerspalten), aber das Event-Modell selbst ist zu eng, um mehr als
die vier heute existierenden Kennzahlen zu tragen.

Positiv: Die bestehende Architektur macht an den richtigen Stellen
schon vieles richtig (siehe Abschnitt 5) – das ist kein Rewrite-Fall,
sondern ein additiver Ausbau.

---

# 2. EXISTING STATISTICS

Was heute Ende-zu-Ende (Backend → API → Frontend) tatsächlich
funktioniert:

| Statistik | Wo | Berechnung |
|---|---|---|
| Live-Spielstand ("Wir 3 : 1 Gegner") | `GamePage.jsx` (Client), erneut in `pdfExportController.js` (Server) | `COUNT(goal-Events) GROUP BY is_opponent` – **zweimal unabhängig implementiert**, nicht zentral |
| Tore pro Spieler (Saison, alle Spiele) | `GET /api/roster/stats` → `StatsPage.jsx` | `SUM(event_type='goal' AND NOT is_opponent) GROUP BY roster_player_id` |
| Strafminuten pro Spieler | `GET /api/roster/stats` | `penalty_2→2, penalty_5→5` summiert |
| Matchstrafen pro Spieler | `GET /api/roster/stats` | `COUNT(event_type='match_penalty')` |
| Einsätze pro Spieler | `GET /api/roster/stats` | `COUNT(game_squad.status='playing')` |
| Spielbericht (PDF) | `POST /api/export/game-report` | Chronologische Event-Liste + Kader-Status + Endstand (Endstand-Logik erneut dupliziert) |
| Spieluhr (Drittel/Zeit) | `games.clock_*`-Spalten, `gameClockController.js` | Kein gespeicherter Tick, Pause/Resume-Delta client-seitig berechnet |

Das ist die **vollständige** Liste. Es gibt keine Team-Dashboard-Seite,
keine Gegner-Vergleiche, keine Perioden-Aufschlüsselung, keine
Situations-Filter (Führung/Rückstand, Powerplay/Unterzahl), keine
Line-Statistiken, keine Schuss-Statistiken, keine
Torhüter-Statistiken.

---

# 3. EXISTING MATCH EVENTS

Tabelle `game_events` – **7 Spalten, fertig, keine weiteren
Migrationen danach**:

```sql
CREATE TABLE game_events (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id          UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  event_type       TEXT NOT NULL CHECK (event_type IN (
    'kickoff_q1', 'kickoff_q2', 'kickoff_q3', 'period_end', 'timeout',
    'goal', 'penalty_2', 'penalty_5', 'match_penalty', 'game_end'
  )),
  roster_player_id UUID REFERENCES roster_players(id) ON DELETE SET NULL,
  is_opponent      BOOLEAN NOT NULL DEFAULT false,
  created_by       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Wichtigste Befunde:

- **`event_type` ist ein starres CHECK-Constraint-Enum**, dreifach
  dupliziert (DB-Constraint, Route-Validator `EVENT_TYPES` in
  `routes/gameEvents.js`, Frontend-`PRESETS` in `GamePage.jsx`) – keine
  gemeinsame Quelle der Wahrheit, kein Weg für Trainer, eigene
  Event-Typen zu ergänzen, ohne eine Migration zu schreiben.
- **Kein Drittel/Perioden-Bezug am Event selbst.** Welches Drittel ein
  Ereignis betrifft, lässt sich nur indirekt aus der Reihenfolge der
  `kickoff_q1`/`kickoff_q2`/`kickoff_q3`/`period_end`-Marker-Events
  rekonstruieren – fragil, kein `period`-Feld.
- **Kein Spieluhr-Zeitstempel am Event**, nur `created_at`
  (Wanduhrzeit). Für Video-Sync oder "was passierte in Minute 12"
  fehlt ein Bezug zur Spielzeit.
- **Keine Position (x/y/Zone), kein Schusstyp, kein Ergebnis
  (Outcome), kein Kräfteverhältnis (5:5/Powerplay/Unterzahl), kein
  Video-Zeitstempel, kein Zweitspieler (Assist), kein
  Line/Shift-Bezug.** Keines dieser Felder existiert – bestätigt durch
  repo-weite Suche.
- Attribution ist binär: **ein** `roster_player_id` ODER
  `is_opponent=true` ODER keins von beidem (nicht zuordenbares
  Tor/Strafe unseres Teams) – niemals beides gleichzeitig
  (`400 Bad Request` wenn versucht).
- **Kein Edit-Endpunkt, nur Löschen.** Bewusste Design-Entscheidung
  ("bei Tippfehler löschen und neu erfassen", Code-Kommentar in
  `gameEventsController.js`) – kein Korrektur-Audit-Log für
  Löschungen.
- **Line-Wechsel während eines Spiels ist explizit KEIN
  `game_events`-Eintrag**, sondern ein Freitext-`comments`-Eintrag
  ("Linienwechsel: <Name>") – unstrukturiert, nicht parsbar, nicht
  konsistent, wenn eine Line später umbenannt wird.

---

# 4. EXISTING LINE SYSTEM

Tabellen `lines` (Template) + `line_players` (Many-to-Many-Junction zu
`roster_players`). Bestätigt: **"Ein Spieler kann in mehreren Lines
sein"** ist korrekt als echte m:n-Relation umgesetzt (kein
Exklusivitäts-Constraint über Lines hinweg).

Das einzige "Nutzung"-Signal ist ein **einzelnes exklusives
`is_active`-Boolean pro Line** (nur eine Line pro
Team/Owner-Gruppe kann aktiv sein – Aktivieren von Line B deaktiviert
automatisch Line A). Kritischer Befund für die neue Architektur:

> **Eine "Match Line" (zeitstempelte, spielbezogene tatsächliche
> Nutzung einer Line) existiert in keiner Form.** `is_active` ist ein
> mutable Flag auf der Template-Zeile selbst, hat **keinen**
> `game_id`-Bezug. Die einzige Spur, dass "Line X während Spiel Y zur
> Zeit T aktiviert wurde", ist der oben erwähnte Freitext-Kommentar –
> keine Tabelle, kein Timestamp-Paar (Start/Ende), keine
> Perioden-Zuordnung, keine Verknüpfung zu `game_events`.

Damit ist auch klar: **Shift-Tracking (Time on Floor, Shift-Dauer,
Line-Zusammensetzung über Zeit) ist komplett nicht vorhanden** – nicht
teilweise, sondern strukturell unmöglich mit dem heutigen Modell.

Lines sind – wie in `migrate.js` selbst dokumentiert – bewusst
**wiederverwendbare taktische Vorlagen**, keine Spiel-Ereignisse. Das
ist eine gute Trennung, die erhalten bleiben muss: die neue
Statistik-Architektur braucht eine **zusätzliche**, von der
Line-Vorlage getrennte "MatchLine"-Tabelle – nicht eine Änderung an
`lines`/`line_players` selbst.

---

# 5. EXISTING DATA MODEL

Relevante Tabellen und ihr aktueller Stand (siehe `backend/src/db/migrate.js`
für die kanonischen Definitionen):

| Tabelle | Zweck | Scoping |
|---|---|---|
| `games` | Ein Spiel: `opponent` (Freitext!), `played_at`, `team_id`, `notes`, 5 Spieluhr-Spalten | `team_id` nullable, direkt |
| `game_events` | Rohereignisse eines Spiels | Transitiv über `games.team_id` (keine eigene `team_id`-Spalte) |
| `game_squad` | Matchkader-Status (`playing`/`reserve`/`injured`/`absent`) | Transitiv über `games.team_id` |
| `roster_players` | `name, jersey_number, role('TW'/'V'/'C'/'S'), team_id` – **kein** `position` getrennt von `role`, kein `preferred_side`, kein `notes` | `team_id` nullable, direkt |
| `lines` / `line_players` | Taktische Spieler-Kombinationen (Vorlage) | `team_id` nullable, direkt |
| `board_videos` | Video pro Board | Nur `board_id` – **keine** Verbindung zu `games`/`game_events` |

Wichtige, für die neue Architektur relevante Muster:

- **Zwei verschiedene Scoping-Stile**: Vorlagen-Ressourcen
  (`roster_players`, `lines`) tragen `team_id` direkt; spielbezogene
  Ressourcen (`game_events`, `game_squad`) erben das Scoping transitiv
  über `games.team_id`. Neue Statistik-Tabellen sollten dem
  spielbezogenen Muster folgen (transitiv über `game_id`), nicht dem
  Vorlagen-Muster.
- **Zugriffsprüfung ist pro Controller dupliziert** (`assertGameRead`/
  `assertGameWrite`, `assertLineRead`/`-Write`, etc.) statt über einen
  gemeinsamen Helfer – für neue Statistik-Endpunkte übernehmen wir das
  bestehende Muster unverändert (keine Refactoring-Baustelle nebenbei
  öffnen).
- **Score wird nirgends gespeichert**, immer aus Events abgeleitet –
  richtig im Prinzip (siehe Abschnitt 58 der Anforderung: "keine
  redundanten Felder"), aber die Ableitung selbst ist **zweimal
  unabhängig implementiert** (Client + PDF-Export) statt zentral.
- **Video und Match/Event-Daten sind vollständig getrennte
  Subsysteme.** `board_videos` hat nur `board_id`. Jede
  Video-Event-Verknüpfung ist heute komplett Neuland – kein Feld, kein
  Stub, keine Tabelle deutet in diese Richtung.

---

# 6. GAP ANALYSIS

## CURRENT
Live-Spielstand, 4 einfache Spieler-Kennzahlen (Tore, Strafminuten,
Matchstrafen, Einsätze), PDF-Spielbericht, Spieluhr. Lines als
taktische Vorlagen mit Exklusiv-Flag. Kein Team-Dashboard.

## RAW DATA (vorhanden)
`games` (Gegner-Freitext, Datum, Team, Spieluhr), `game_events` (10
starre Typen, ein Spieler ODER Gegner-Flag, Erstellungszeit),
`game_squad` (4 Status), `lines`/`line_players` (Vorlagen, m:n),
`roster_players` (Name, Nummer, Rolle/Position, Team).

## MISSING DATA
- Position (x/y/Zone) an Ereignissen
- Schusstyp, Ergebnis (Outcome: Tor/Halten/Verfehlt/Geblockt)
- Zweitspieler/Assist
- Kräfteverhältnis (5:5/Powerplay/Unterzahl/Empty Net)
- Video-Zeitstempel am Ereignis
- Perioden-Bezug am Ereignis (nur indirekt über Marker-Events)
- Spielzeit-Sekunden am Ereignis (nur Wanduhrzeit vorhanden)
- Match-Line/Shift-Historie (Start/Ende/Dauer/Periode einer
  tatsächlichen Line-Nutzung während eines Spiels)
- Erweiterbare/benutzerdefinierte Event-Typen
- Strukturierte Gegner-Entität (heute Freitext auf `games.opponent`,
  keine eigene `opponents`-Tabelle, keine Historie über mehrere
  Spiele gegen denselben Gegner hinweg außer über den exakt gleichen
  Freitext-String)
- Saison/Wettbewerbs-Gruppierung von Spielen

## STATISTICS (heute berechenbar)
Tore/Strafminuten/Matchstrafen/Einsätze pro Spieler (Saison-Summe über
alle Spiele), Live-Spielstand pro Spiel.

## ADVANCED (heute NICHT möglich)
Schuss-%, xG, Line-Chemie, On-Ice/Off-Ice-Splits, Special-Teams-%,
Torhüter-Statistiken, Situations-Splits (Führung/Rückstand,
Powerplay/Unterzahl), Perioden-Aufschlüsselung, Time on Floor,
Shift-Anzahl/-Dauer, Assists, Schuss-Karten/Heatmaps, Gegner-Profile.

## ARCHITECTURE (erforderliche Änderungen)
1. Erweiterbares Event-Typ-System (Definitionstabelle statt
   CHECK-Constraint) – ohne bestehende 10 Typen/bestehende Tests zu
   brechen.
2. Optionale, breitere Event-Spalten (Position, Outcome, Schusstyp,
   Kräfteverhältnis, Assist, Video-Zeitstempel, Periode,
   Spielzeit-Sekunden, Metadata-JSONB für echte Custom-Felder).
3. Neue `match_lines`-Tabelle für Shift-/Line-Historie, entkoppelt von
   der bestehenden `lines`-Vorlage.
4. Zentrale, gemeinsam genutzte **Statistics Engine** (Backend-Modul),
   die die aktuell duplizierte Score-Logik ablöst und alle
   zukünftigen Kennzahlen an einer Stelle berechnet.
5. Dokumentierte Formeln (`docs/statistics.md`), Sample-Size- und
   Datenqualitäts-Konventionen ("unbekannt ≠ 0").

---

# 7. COMPETITOR FEATURE MATRIX

Ergebnis der Recherche zu Floorball-spezifischen Systemen (GameStats,
GoalHunter, FloorballStats, MyCoazh, Sportlin/Analyzer, Floorball
Scanner) sowie Hockey-/allgemeinen Sport-Analytics-Systemen
(Sportlogiq, Hudl InStat/Sportscode, Performa, Nacsport, LongoMatch,
Catapult, GameChanger). Öffentliche Informationslage zu den
Floorball-Nischenprodukten ist dünn – als solche markiert (`?`).

| Feature | OpenFloorball (heute) | Floorball-Produkte (Schnitt) | Hockey/General-Systeme (Schnitt) | Priorität |
|---|---|---|---|---|
| Event Tracking | ✓ (starr, 10 Typen) | ✓ | ✓ (oft frei definierbar) | P0 |
| Shot Tracking | ✗ | ✓ meist mit Position | ✓ | P1 |
| Heatmaps/Shot Maps | ✗ | ✓ (oft Pro-Tier) | ✓ | P1 |
| Line/Shift-Analytics | ✗ (strukturell unmöglich) | ✓ ("Chains"/Shifts) | teils ✓ | P1 |
| xG o.ä. | ✗ | vereinzelt (claimed) | ✓ bei Sportlogiq | P3 (erst mit Datenbasis) |
| Torhüter-Analytics | ✗ | ✗ (Marktlücke, auch bei Konkurrenz) | ? kaum belegt | P2 (Chance!) |
| Custom Events/Tagging | ✗ | ? unklar | ✓ (Sportscode, Nacsport, LongoMatch) | P2 |
| Video↔Event-Verknüpfung | ✗ (kein Schema-Stub) | teils ✓ | ✓ fast überall Kernfeature | P2 |
| Reports/Export | ✓ (PDF, kein CSV/JSON) | ✓ | ✓ (CSV/XML verbreitet) | P1 (Export ausbauen) |
| API | ✓ (intern, kein Statistik-API) | ✗ meist | ✓ teils (Sportlogiq, Sportscode-XML) | P2 |
| Live/Mobile-Erfassung | ✓ (einfache Presets) | ✓ | ✓ | bereits gut |
| Situations-Analyse (Score-State/PP/PK) | ✗ | teils ✓ | ✓ | P2 |

**Wiederkehrende Muster aus der Recherche, die die Architektur prägen
sollen** (Details siehe Anhang unten):

1. Live-Erfassung muss so einfach bleiben, dass Detailtiefe NIE die
   Tap-Geschwindigkeit im Spiel gefährdet – Zusatzfelder sind optional,
   nie Pflicht beim schnellen Erfassen.
2. Dasselbe Event-Schema muss live UND nachträglich (aus Video)
   nutzbar sein – kein Feld darf "Video muss zum Zeitpunkt X existieren"
   voraussetzen.
3. Video-Zeitstempel ist die verbindende Klammer nahezu aller
   professionellen Systeme – als optionales Feld von Anfang an
   vorsehen, auch bevor die Video-Verknüpfung selbst gebaut wird.
4. Positionsdaten (x/y) gehören als optionales Attribut an JEDES
   Ereignis, nicht nur an Schüsse – ermöglicht später Heatmaps für
   Ballverluste, Ballgewinne etc., nicht nur Tore.
5. Eigene Tagging-Vorlagen pro Team/Saison statt starrer globaler
   Taxonomie – ein hartkodiertes Enum stößt an die gleiche Grenze, die
   diese Systeme bereits gelöst haben.
6. Korrektur/Nachbearbeitung ist Standard, nicht Ausnahme – muss
   auditierbar sein (§19.5/71 in `CLAUDE.md`).
7. Torhüter-Analytics ist eine echte Marktlücke – selbst die
   verglichenen Profi-Systeme bieten hier kaum etwas Dediziertes.
8. Abgeleitete Kennzahlen (xG, Schuss-Differential) sind immer eine
   transparente, nachrechenbare Projektion über dem Rohereignis-Log,
   nie ein Ersatz dafür – deckt sich direkt mit dem
   Explainable-AI-Prinzip aus `CLAUDE.md` §5.10/18.3.

---

# 8. PROPOSED STATISTICS DATA MODEL

Grundsatz: **additiv, nicht brechend.** Keine bestehende Spalte wird
entfernt oder umbenannt; kein bestehender Test darf durch Phase 1
kaputtgehen (Verifikation: vollständige Backend-Testsuite muss nach
Migration weiterhin grün sein).

## 8.1 `event_type_definitions` (NEU)

> ✅ Umgesetzt (Phase 1, Commit `f5f2ef6`). Zusätzlich in Phase 3: ein
> 11. Eintrag `shot` (siehe §9) – neue Typen brauchen weiterhin nur
> einen `INSERT`, keine Migration.

```sql
CREATE TABLE event_type_definitions (
  key                      TEXT PRIMARY KEY,
  category                 TEXT NOT NULL,
  label_de                 TEXT NOT NULL,
  label_en                 TEXT NOT NULL,
  icon                     TEXT,
  color                    TEXT,
  requires_player          BOOLEAN NOT NULL DEFAULT false,
  requires_secondary_player BOOLEAN NOT NULL DEFAULT false,
  requires_position        BOOLEAN NOT NULL DEFAULT false,
  requires_outcome         BOOLEAN NOT NULL DEFAULT false,
  requires_strength_state  BOOLEAN NOT NULL DEFAULT false,
  is_builtin               BOOLEAN NOT NULL DEFAULT false,
  team_id                  UUID REFERENCES teams(id) ON DELETE CASCADE,
  active                   BOOLEAN NOT NULL DEFAULT true,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Die 10 bestehenden Typen werden als `is_builtin = true, team_id = NULL`
eingepflegt (globale, unlöschbare Definitionen). Neue, von Trainern
selbst definierte Typen (Phase 7, "Custom Events") bekommen
`is_builtin = false` und ein konkretes `team_id`. **Kein Trainer kann
eine `is_builtin`-Zeile löschen oder deaktivieren** (schützt
Statistik-Konsistenz).

## 8.2 `game_events` erweitern (bestehende Tabelle, additiv)

```sql
ALTER TABLE game_events
  ALTER COLUMN event_type DROP ... -- CHECK-Constraint entfernen (siehe unten)
  ADD COLUMN secondary_roster_player_id UUID REFERENCES roster_players(id) ON DELETE SET NULL,
  ADD COLUMN period                     INT,
  ADD COLUMN clock_seconds_at_event      INT,
  ADD COLUMN outcome                    TEXT,
  ADD COLUMN shot_type                  TEXT,
  ADD COLUMN strength_state             TEXT, -- ✅ Phase 4: serverseitig auto-befüllt, siehe ADR-0004
  ADD COLUMN x                          REAL,
  ADD COLUMN y                          REAL,
  ADD COLUMN zone                       TEXT,
  ADD COLUMN video_timestamp_seconds    REAL,
  ADD COLUMN metadata                   JSONB NOT NULL DEFAULT '{}';

ALTER TABLE game_events
  ADD CONSTRAINT game_events_event_type_fkey
  FOREIGN KEY (event_type) REFERENCES event_type_definitions(key);
```

Das starre `CHECK`-Constraint wird durch eine **FK auf
`event_type_definitions`** ersetzt – funktional äquivalent (nur
bekannte Typen erlaubt), aber neue Typen brauchen nur einen `INSERT`,
keine Migration mehr. Alle neuen Spalten sind **nullable** – bestehende
Inserts (`addEvent` mit nur `eventType` + optional `rosterPlayerId`/
`isOpponent`) funktionieren unverändert weiter.

`period` und `clock_seconds_at_event` werden vom Server beim Insert
**automatisch** aus `games.clock_period`/`clock_elapsed_seconds`
gesetzt (best effort, nullable falls Uhr nie gestartet wurde) – kein
Client-Input nötig, kein Bruch der bestehenden, bewusst minimalen
Presets-UI.

## 8.3 `match_lines` (NEU)

> ✅ Umgesetzt (Phase 2). `line_id`/`line_name`/`period`/`started_at`/
> `ended_at`/`created_by` exakt wie unten beschrieben; zusätzlich ein
> `CHECK (ended_at IS NULL OR ended_at >= started_at)` und ein
> partieller Unique-Index (`WHERE ended_at IS NULL`) für höchstens eine
> offene Zeile pro Spiel. `calculateLineStats` in `statisticsEngine.js`
> mit halb-offenem Zeitfenster `[started_at, ended_at)`.

```sql
CREATE TABLE match_lines (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id    UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  line_id    UUID REFERENCES lines(id) ON DELETE SET NULL,
  line_name  TEXT NOT NULL,
  period     INT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at   TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
);
```

`line_name` ist ein **Snapshot** (nicht live über `line_id` gejoint) –
überlebt Umbenennung/Löschung der Vorlage, ohne die Match-Historie zu
verfälschen (gleiches Prinzip wie andere Snapshot-Felder im Repo, z.B.
`toApiMember`'s E-Mail-Snapshot-Pattern). `ended_at IS NULL` bedeutet
"noch auf dem Feld". Aktivieren einer neuen Line während eines Spiels
schließt automatisch die vorherige offene `match_lines`-Zeile
(`ended_at = NOW()`) und öffnet eine neue – ersetzt den bisherigen
Freitext-Kommentar-Hack 1:1, ohne `lines.is_active` selbst
anzufassen (das bleibt für die reine Taktik-Vorbereitung ausserhalb
von Live-Spielen erhalten).

## 8.4 Was bewusst NICHT gebaut wird (Phase 1)

- **Keine `opponents`-Tabelle.** `games.opponent` bleibt Freitext – ein
  strukturiertes Gegner-Profil samt Saison-/Wettbewerbs-Gruppierung von
  Spielen (Abschnitt 46/47 der Anforderung) ist bewusst **kein Teil der
  9 EPIC-012-Phasen** (Roadmap-Tabelle, Abschnitt 11) – dafür fehlt in
  keiner der neun Phasen ein Bezug. Bleibt ein eigenständiges, mögliches
  künftiges Backlog-Item außerhalb dieser Statistik-Architektur (z.B.
  als Teil einer künftigen "Spielverwaltung"-Erweiterung), kein
  Bestandteil des Kern-Event-Modells. Siehe Phasenplanungs-Review vom
  2026-08-21 in `docs/planning/BACKLOG.md`.
- **Kein gespeicherter Score.** Bleibt abgeleitet – nur die
  *Berechnung* wird zentralisiert (Statistics Engine, Abschnitt 10),
  nicht die Persistenz geändert.
- **Kein Edit-Endpunkt für Events.** Die bestehende
  Löschen-und-neu-Erfassen-Konvention bleibt – ergänzt um ein
  einfaches Audit-Log für Löschungen (siehe Phase 1 Aufgaben), statt
  ein vollständiges Diff-basiertes Korrektursystem zu bauen, das der
  bestehenden UX-Entscheidung widersprechen würde.

## 8.5 Zonen-Taxonomie (Phase 3)

> ✅ Umgesetzt. Details/Formel siehe `docs/statistics.md`
> ("Zonen-Taxonomie").

5 Zonen (Nahzone Zentrum/Links/Rechts, Halbdistanz, Distanz), bewusst
NICHT aus dem Eishockey übernommen (kein "Slot"/"Point"/"blaue
Linie"). `deriveZone(x, y)` ist bewusst dupliziert in
`backend/src/services/statisticsEngine.js` UND
`frontend/src/constants/shotZones.js` (kein Shared-Package, gleiche
Toleranz wie z.B. `toDateString`) – der Server befüllt `zone`
automatisch, falls der Client nur `x`/`y` schickt.

## 8.6 `shot`-Ereignis + Companion-Goal-Event (Phase 3, ADR-0002/0003)

> ✅ Umgesetzt.

Ein neuer, einziger `shot`-Event-Typ (statt vier Typen, siehe
Abschnitt 9) trägt `outcome ∈ {goal, save, miss, block}`,
`shot_type`, `x`/`y`/`zone`. Bei `outcome='goal'` erzeugt der Server
zusätzlich, in derselben Transaktion, ein schlankes Companion-
`goal`-Event (nur `roster_player_id`/`is_opponent`/`period`/
`clock_seconds_at_event`/`created_by` kopiert, KEIN Schuss-Detail) –
verknüpft über `metadata.companionGoalEventId` (bestehende JSONB-
Spalte, keine neue). Grund: bestehende, bereits getestete Konsumenten
(`calculateMatchScore`, `getRosterStats`, PDF-Export,
`GamePage.jsx`-Scoreboard) bleiben dadurch komplett unverändert.
`addEvent`/`deleteEvent` sind seither transaktional
(`pool.connect()`/`BEGIN`/`COMMIT`/`ROLLBACK`); Löschen eines Schusses
löscht sein Companion-Event mit (sonst verwaister Score-Zähler),
beide werden im Audit-Log (`game_event_deletions`) protokolliert.

Torhüter-Zuordnung bei einem Gegner-Schuss (`is_opponent=true`) läuft
über `secondary_roster_player_id`, NICHT `roster_player_id` – Letzteres
ist durch die bestehende Regel "`rosterPlayerId` und `isOpponent` nie
gleichzeitig" blockiert (ADR-0003).

Das bestehende einfache "Tor"-Preset (kein Schuss-Detail) bleibt
unverändert als schnelle Alternative bestehen – Schuss-Tracking ist
additiv, kein Ersatz.

---

# 9. EVENT MODEL

Kanonisches `MatchEvent` (Zielzustand nach Phase 1), OpenFloorball-Namen:

```
game_events
├── id                          UUID
├── gameId                      UUID        (→ games, transitives Team-Scoping)
├── eventType                   TEXT        (→ event_type_definitions.key, erweiterbar)
├── period                      INT?        (automatisch aus games.clock_period)
├── clockSecondsAtEvent         INT?        (automatisch aus games.clock_elapsed_seconds)
├── rosterPlayerId               UUID?       (Hauptspieler)
├── secondaryRosterPlayerId      UUID?       (NEU: Assist/Zweitbeteiligter)
├── isOpponent                  BOOLEAN     (unverändert)
├── outcome                     TEXT?       (z.B. goal/save/miss/block – Bedeutung je eventType)
├── shotType                    TEXT?
├── strengthState                TEXT?       (even/powerplay/shorthanded/empty_net)
├── x, y, zone                  REAL?/TEXT? (optional an JEDEM Event, nicht nur Schüssen)
├── videoTimestampSeconds        REAL?       (Vorbereitung für Phase 6, heute ungenutzt)
├── metadata                    JSONB       (Catch-all für echte Custom-Event-Felder)
├── createdBy                   UUID
└── createdAt                   TIMESTAMPTZ
```

## 8.7 Trainings-Analytics/Spielerentwicklung (Phase 5)

Anders als Phase 1–4 (Match-Events) eine eigene, kleinere Domäne ohne
Bezug zu `game_events`/`event_type_definitions` – Grundlage sind
`training_sessions`/`roster_players`, nicht `games`.

`training_attendance` (NEU): tatsächliche Anwesenheit bei einem
Training, strukturell identisch zu `game_squad` (echte Junction,
`UNIQUE (session_id, roster_player_id)`, `ON DELETE CASCADE` an beiden
FKs), aber mit trainings-eigenen Status-Werten (`present`, `excused`,
`absent`, `injured` statt `playing`/`reserve`/…). Bewusst getrennt von
RSVP (`rsvps`, Selbstauskunft VOR dem Termin) – ein Spieler kann
zugesagt haben und trotzdem nicht erschienen sein, das eine ersetzt
das andere nicht.

`player_development_notes` (NEU): freie, zeitgestempelte
Beobachtungsnotizen eines Coaches zu einem Kader-Spieler, optional mit
`training_session_id`-Kontext (`ON DELETE SET NULL` – die Notiz
überlebt das Löschen des Trainings). Bewusst NICHT über die
bestehende, polymorphe `comments`-Tabelle (dort für Boards/Trainings/
Spiele, mit "jedes Team-Mitglied liest mit") – Entwicklungsnotizen
sind personenbezogene Daten ÜBER einen Spieler (oft minderjährig),
keine Diskussion ZU einer Ressource, daher ein eigener, restriktiverer
Zugriff (nur coach/owner, nie `member`, siehe
`playerDevelopmentNotesController.js`).

Ableitungen: `GET /api/roster/stats` liefert zusätzlich
`trainingsRecorded`/`trainingsPresent`/`attendanceRate` je Spieler
(analog `appearances` aus `game_squad`, `null` statt `0` ohne ein
einziges erfasstes Training – "unbekannt ≠ 0", siehe Abschnitt 10).
`GET /api/roster/:id/training-log` liefert den Trainings-für-Training-
Verlauf für Last-5/Last-10/Season-Trends im Frontend, exakt analog
`game-log` aus Phase 4.

Bewusst NICHT Teil dieser Phase: Aufnahme in den GDPR-Backup-Export
(`exportUserData.js`) – der Export deckt aktuell die gesamte
Spiel-Domäne (`games`/`game_events`/`game_squad`) ebenfalls nicht ab;
Trainings-Anwesenheit/Entwicklungsnotizen konsistent zu diesem
bestehenden Stand zu halten statt isoliert vorzuziehen. Nachgezogen
werden sollte das gemeinsam mit der Spiel-Domäne, nicht separat –
offener Folgepunkt, siehe `docs/planning/BACKLOG.md`.

---

## Welche der in der Anforderung vorgeschlagenen "Grundtypen" werden wie behandelt

Die Anforderung listet ca. 30 mögliche Grundtypen (GOAL, SHOT,
ASSIST, SAVE, TURNOVER, FACE_OFF, LINE_CHANGE,
POWERPLAY_START/END, …). Nicht alle werden 1:1 als eigene
`event_type_definitions`-Zeile übernommen – nach Abschnitt 88 der
Anforderung selbst ("zuerst prüfen: kann sie aus bestehenden Daten
berechnet werden?") gilt:

| Vorschlag | Entscheidung | Begründung |
|---|---|---|
| GOAL, SHOT_ON_GOAL, SHOT_MISSED, SHOT_BLOCKED | ✅ Umgesetzt (Phase 3): EIN Typ `shot`, mit `outcome` differenziert statt 4 Typen | Ein `shot`-Event mit `outcome ∈ {goal, save, miss, block}` ist ein Feld, nicht vier Event-Typen – konsistent mit Abschnitt 13 der Anforderung selbst. Bei `outcome='goal'` wird zusätzlich ein schlankes Companion-`goal`-Event erzeugt (ADR-0002), damit bestehende Konsumenten unverändert bleiben. |
| ASSIST, SECONDARY_ASSIST | **Kein eigener Event-Typ** – `secondaryRosterPlayerId`-Feld auf dem `goal`/`shot`-Event. Für `shot` mit `is_opponent=true` wird dasselbe Feld seit Phase 3 stattdessen für "unser Torhüter" verwendet (ADR-0003) – Assist bei `is_opponent=false` bleibt noch ungenutzt. | Ein Assist ist kein eigenständiges Ereignis, sondern eine Attribution am Tor-Ereignis |
| SAVE, GOAL_CONCEDED | ✅ Umgesetzt (Phase 3): abgeleitet aus `shot.outcome` bzw. `is_opponent` | Kein separates Event nötig |
| TURNOVER, TAKEAWAY, INTERCEPTION, BLOCK, CLEARANCE | Weiterhin nicht gebaut – mögliche spätere, optionale Typen | Wertvoll für Floorball, aber ohne eigenen UI-Erfassungsweg nutzlos; `block` existiert bereits als `shot`-`outcome`, nicht als eigener Event-Typ |
| FACE_OFF/-_WIN/-_LOSS | **Nicht als Built-in-Typ** | Kein etabliertes Floorball-Kernkonzept (anders als Eishockey-Bully); als optionaler Custom-Typ (Phase 7) möglich, falls ein Verein es will |
| LINE_CHANGE, SHIFT_START, SHIFT_END | **Kein Event-Typ** – abgebildet über `match_lines`-Tabelle (Abschnitt 8.3) | Strukturierter als ein Event-Strom, siehe Abschnitt 4 |
| POWERPLAY_START/END, PENALTY_KILL_START/END | ✅ Umgesetzt (Phase 4): **Kein eigener Event-Typ** – `strength_state` wird auf jedem Event serverseitig aus aktiven `penalty_2`/`penalty_5`-Fenstern abgeleitet (`match_penalty` erzeugt bewusst kein Fenster, siehe ADR-0004) | Aus Anforderung §88 selbst: nicht speichern, wenn berechenbar |
| TIMEOUT | Bereits vorhanden (`timeout`) | – |
| SUBSTITUTION | Bereits abgedeckt über `game_squad`-Status-Änderungen | Kein neues Event nötig |
| CUSTOM_EVENT | Umgesetzt als generisches Konzept: **jede** Zeile in `event_type_definitions` mit `is_builtin=false` ist ein Custom Event | Kein Sonderfall-Typ namens "CUSTOM_EVENT", sondern das ganze System ist custom-fähig |

Ergebnis: Statt 30 starrer Typen entstehen **11 durchdachte
Built-in-Typen** (die bestehenden 10 aus Phase 1 plus `shot` aus
Phase 3) plus ein echtes Erweiterungsmechanismus für alles Weitere –
schlanker und floorball-eigen statt hockey-transplantiert, wie in
Abschnitt 65 der Anforderung explizit gefordert. `turnover`/`takeaway`
bleiben mögliche spätere Ergänzungen, nicht Teil von Phase 3.

---

# 10. STATISTICS ENGINE ARCHITECTURE

Neues Backend-Modul `backend/src/services/statisticsEngine.js` –
**reine Funktionen, kein Express, kein direkter DB-Zugriff** (nimmt
bereits geladene Zeilen/Arrays entgegen, gibt Zahlen/Objekte zurück).
Isoliert unit-testbar ohne Testdatenbank.

```
statisticsEngine.js
├── calculateMatchScore(events)              → { ownGoals, opponentGoals }        ✅ Phase 1
├── calculatePlayerMatchStats(events, squad, rosterPlayerId)
├── calculateTeamSeasonStats(gamesWithEvents)
├── calculateLineStats(matchLines, events)                                        ✅ Phase 2
├── deriveZone(x, y) / SHOT_ZONES                                                 ✅ Phase 3
├── calculateShotStats(events)                                                    ✅ Phase 3
├── calculateGoalkeeperStats(events)                                              ✅ Phase 3
├── calculateSpecialTeamsStats(events, { periodMinutes })                          ✅ Phase 4
├── calculateSituationalStats(events)                                              ✅ Phase 4
```

Frontend darf **keine eigene Statistiklogik besitzen** – die
`ownGoals`/`opponentGoals`-Berechnung in `GamePage.jsx` und die
identische, unabhängig gepflegte Logik in `pdfExportController.js`
werden beide durch Aufrufe derselben Engine-Funktion ersetzt
(`gamesController`/`pdfExportController` rufen
`calculateMatchScore()`; das Frontend bekommt den Score wahlweise vom
Server oder rechnet für die optimistische Live-Anzeige exakt dieselbe
einfache Filterlogik nach – aber es gibt nur noch **eine**
Implementierung, aus der beide abgeleitet sind, nicht zwei getrennt
gepflegte).

Konventionen (aus Abschnitt 58–62 der Anforderung übernommen, gelten
für alle künftigen Kennzahlen):

- **Nicht speichern, was berechenbar ist** – keine neue
  `player_statistics`-Spalte, bevor nicht geprüft wurde, ob die Zahl
  aus Events ableitbar ist.
- **Unbekannt ≠ 0.** Solange z.B. kein Shift-Tracking für ein Spiel
  existiert, ist "Time on Floor" `null`/"unbekannt", nicht `0`.
  Statistikseiten müssen das UI-seitig unterscheidbar darstellen.
- **Sample Size immer mitliefern.** Jede künftige `/60`-Kennzahl wird
  als `{ value, per60, sampleSeconds }` zurückgegeben, nie als
  nackte Zahl.
- **Keine Materialized Views/Aggregations-Tabellen vor Bedarf** – bei
  den heutigen Datenmengen (ein Verein, einzelne Saison) ist direkte
  SQL-Aggregation schnell genug; erst bei nachgewiesenem
  Performance-Bedarf optimieren (Anforderung §59).

---

# 11. ROADMAP

| Phase | Inhalt | Abhängigkeit |
|---|---|---|
| **0** | Dieses Dokument (Audit, Gap-Analyse, Architektur) | – ✅ umgesetzt |
| **1** | `event_type_definitions`, erweiterte `game_events`-Spalten, Statistics Engine (Score-Zentralisierung), `docs/statistics.md`, Tests | Phase 0 – ✅ umgesetzt (Commit `f5f2ef6`) |
| **2** | `match_lines`, Time-on-Floor/Shift-Zahlen, Line-Statistiken (Goals For/Against, Zeit zusammen) | Phase 1 – ✅ umgesetzt |
| **3** | Shot Tracking (UI + `shot`-Events mit x/y/outcome/shotType), Shot Map, floorball-eigene Zonen-Definition, einfache Torhüter-Statistiken | Phase 1 – ✅ umgesetzt |
| **4** | Special Teams (PP/PK, aus Strafen+Uhr abgeleitet), Situations-Splits (Score-State, Periode), Spieler-Vergleich, Trends | Phase 1–3 – ✅ umgesetzt (ADR-0004) |
| **5** | Trainings-Analytics/Spielerentwicklung (eigene Domäne, niedrigere Priorität für dieses Dokument) | – ✅ umgesetzt |
| **6** | Video-Integration: eigene `game_videos`-Tabelle (ADR-0005), Event→Video-Sprung über `videoId`/`videoTimestampSeconds` | Phase 1 – ✅ umgesetzt |
| **7** | Custom-Events-UI (Trainer definiert eigene `event_type_definitions`-Zeilen, team-eigen oder persönlich), CSV-Export (Kennzahlen + Spiele) statt eines offenen Report Builders (ADR-0006) | Phase 1 – ✅ umgesetzt |
| **8** | Advanced Analytics: xG-Modell v1 (erst mit ausreichender Datenbasis), Line-Chemie, Shot Quality – Modellversionierung dokumentiert | Phase 3 |
| **9** | KI/ML-Grundlagen (Pattern Detection, automatische Spiel-Insights) – ausschließlich als nachvollziehbare Vorschläge, nie autoritativ (§5.9/18 `CLAUDE.md`) | Phase 8 |

---

# 12. FIRST IMPLEMENTATION TASKS (Phase 1)

1. Migration: `event_type_definitions` anlegen, 10 bestehende Typen
   als `is_builtin=true` seeden.
2. Migration: `game_events` additiv erweitern (siehe 8.2), CHECK durch
   FK ersetzen – **Verifikation**: komplette bestehende Backend-Suite
   muss danach unverändert grün bleiben (Regressionsschutz).
3. Migration: Lösch-Audit-Log für `game_events` (wer hat wann welches
   Event mit welchem `event_type`/welcher Attribution gelöscht) –
   erfüllt Auditierbarkeits-Prinzip ohne die bestehende
   Löschen-statt-Editieren-UX zu ändern.
4. Backend: `statisticsEngine.js` anlegen, `calculateMatchScore`
   implementieren, `gamesController`/`pdfExportController` auf das
   Modul umstellen (Duplikat entfernen).
5. Backend: `addEvent`/Validator um die neuen optionalen Felder
   erweitern (alle optional – kein Breaking Change für bestehende
   Clients/Tests).
6. Backend: `period`/`clockSecondsAtEvent` serverseitig automatisch
   aus dem aktuellen Spieluhr-Zustand befüllen.
7. Dokumentation: `docs/statistics.md` – jede heute UND neu
   ermöglichte Kennzahl mit Name/Definition/Formel/Datenbedarf/
   Einschränkungen (Vorlage siehe Anforderung Abschnitt 72).
8. ADR-0001 in `docs/planning/DECISIONS.md` – Entscheidung für
   Definitionstabelle statt starres Enum, mit Alternativen-Abwägung.
9. Tests: `statisticsEngine.test.js` (isoliert, keine Testdatenbank
   nötig), Erweiterung `gameEvents.test.js` für neue optionale Felder,
   Migration-Idempotenz-Test (frische DB vs. bereits migrierte DB).
10. **Kein Pflicht-UI-Change** – Phase 1 ist Datenmodell + Engine.
    Die bestehende, bewusst minimale Presets-UI bleibt unverändert
    funktionsfähig; optionale Felder werden erst ab Phase 3 (Shot
    Tracking) über UI erfassbar.

---

# Anhang: Recherche-Rohbefunde

Vollständige Produktrecherche (Methodik, Quellen, Detail-Feature-Matrix
mit 17 Produkten) liegt als Session-Artefakt vor und wird bei Bedarf
für Phase 3/6/7/8 erneut herangezogen (Shot-Zonen-Definition,
Video-Verknüpfungs-Patterns, Custom-Tagging-Vorlagen). Nicht in dieses
Dokument kopiert, um es wartbar zu halten – bei Bedarf erneut
recherchieren, da sich Produkte/Public-Docs schnell ändern.
