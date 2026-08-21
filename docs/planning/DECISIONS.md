# DECISIONS.md

# OpenFloorball Coach Platform

## Architecture Decision Records

---

# Zweck

Dieses Dokument hält wichtige technische Entscheidungen fest.

Warum?

Weil zukünftige Entwickler verstehen müssen:

* was entschieden wurde
* warum es entschieden wurde
* welche Alternativen betrachtet wurden

---

# Format

Jede Entscheidung folgt diesem Muster:

---

# ADR-XXXX: Titel

## Datum

YYYY-MM-DD

---

## Status

Optionen:

* vorgeschlagen
* akzeptiert
* abgelehnt
* ersetzt

---

## Kontext

Welches Problem muss gelöst werden?

Welche Anforderungen bestehen?

---

## Entscheidung

Welche Lösung wurde gewählt?

---

## Alternativen

Welche anderen Lösungen wurden betrachtet?

---

## Begründung

Warum wurde diese Lösung gewählt?

---

## Konsequenzen

Welche Vorteile entstehen?

Welche Nachteile entstehen?

---

# Beispiel ADR-0001

## Titel

Local First Architektur

---

## Status

Akzeptiert

---

## Kontext

Trainer arbeiten häufig in Umgebungen mit schlechter Internetverbindung.

Die Plattform muss zuverlässig funktionieren.

---

## Entscheidung

Die Anwendung wird nach Local-First-Prinzipien entwickelt.

Lokale Datenhaltung ist Standard.

Cloud dient zur Synchronisation.

---

## Alternativen

### Cloud First

Vorteile:

* einfache zentrale Verwaltung

Nachteile:

* abhängig vom Internet
* weniger Datensouveränität

---

### Offline Export

Vorteile:

* einfach

Nachteile:

* keine echte Zusammenarbeit

---

## Begründung

Local First unterstützt:

* Datenschutz
* Geschwindigkeit
* Offline Nutzung
* Nutzerkontrolle

---

## Konsequenzen

Vorteile:

* bessere Nutzererfahrung
* weniger Abhängigkeit

Nachteile:

* komplexere Synchronisation

---

# Beispiel ADR-0002

## Titel

Offene Datenformate

---

## Status

Akzeptiert

---

## Entscheidung

Alle Kernobjekte werden in offenen Formaten gespeichert.

---

## Begründung

Die Nutzer besitzen ihre Daten.

Export und Migration müssen jederzeit möglich sein.

---

# Beispiel ADR-0003

## Titel

KI-Abstraktionsschicht

---

## Status

Akzeptiert

---

## Entscheidung

KI-Funktionen werden über eine austauschbare Schnittstelle integriert.

---

## Begründung

Keine Abhängigkeit von einem einzelnen Anbieter.

Unterstützung für:

* lokale Modelle
* Open Source
* verschiedene Anbieter

---

# Tatsächliche Entscheidungen

Die obigen ADR-0001 bis ADR-0003 sind Beispiele aus der ursprünglichen
Planung. Ab hier folgen echte, getroffene Entscheidungen.

---

# ADR-0001: Erweiterbares Event-Typ-System statt starres Enum

## Datum

2026-08-10

---

## Status

Akzeptiert

---

## Kontext

`game_events.event_type` ist ein starres `CHECK`-Constraint-Enum mit
genau 10 Werten, zusätzlich dreifach dupliziert (DB-Constraint,
Route-Validator, Frontend-Presets). Die geplante Statistik-/
Analytics-Architektur (siehe
`docs/planning/STATISTICS_ANALYTICS_ARCHITECTURE.md`) braucht
langfristig deutlich mehr Ereignistypen (Schüsse mit Ergebnis,
Ballverluste/-gewinne, perspektivisch von Trainern selbst definierte
Custom-Events), ohne dass jeder neue Typ eine Schema-Migration
erfordert.

---

## Entscheidung

`event_type` bleibt ein Text-Feld, verweist aber per Fremdschlüssel
auf eine neue Tabelle `event_type_definitions` (Key, Kategorie,
Label DE/EN, Icon, Farbe, benötigte Zusatzfelder, `is_builtin`,
optionales `team_id` für vereinsspezifische Custom-Typen). Die 10
bestehenden Typen werden unverändert als `is_builtin = true`
übernommen. Neue Typen erfordern nur einen `INSERT`, keine Migration
mehr.

---

## Alternativen

### Enum unverändert lassen, neue Typen weiter per Migration ergänzen

Vorteile: keine Änderung nötig.

Nachteile: jeder neue Event-Typ (auch vereinsspezifische
Custom-Events, siehe Anforderung Abschnitt 7) erfordert eine
Migration – widerspricht dem Ziel, Trainern eigene Tagging-Vorlagen
zu ermöglichen (Recherche-Befund: genau dieses Muster – Sportscode
"Code Windows", Nacsport freie Buttons, LongoMatch-Dashboards – zieht
sich durch praktisch alle professionellen Systeme).

### Rein freies Textfeld ohne Definitionstabelle

Vorteile: maximal flexibel, keine neue Tabelle.

Nachteile: keine Validierung, keine Kategorisierung/Farben/Icons für
die UI, keine Unterscheidung "eingebaut, unlöschbar" vs. "vom Verein
selbst angelegt" – Statistik-Konsistenz (z.B. Torhüter-Statistiken,
die sich auf `event_type = 'shot'` verlassen) wäre nicht geschützt.

---

## Begründung

Die Definitionstabelle erhält die heutige Sicherheit (nur bekannte
Typen sind gültig, per FK statt CHECK erzwungen) und macht das System
gleichzeitig erweiterbar, ohne die zehn bestehenden, in Tests und
Frontend fest verankerten Typen anzufassen. Entspricht CLAUDE.md
§5.4 (Open Source First/keine unnötige Komplexität) und dem in der
Anforderung explizit geforderten Prinzip "Event System muss
erweiterbar sein, ohne massive Migrationen".

---

## Konsequenzen

Vorteile:

* Neue Ereignistypen (auch vereinsspezifische) ohne Migration.
* Bestehende Typen/Tests/Frontend-Presets bleiben unverändert
  funktionsfähig.
* Grundlage für spätere Custom-Tagging-Vorlagen (Roadmap Phase 7).

Nachteile:

* Eine zusätzliche Tabelle und ein zusätzlicher JOIN gegenüber einem
  reinen Constraint.
* Schutz der `is_builtin`-Zeilen (nicht löschbar/deaktivierbar durch
  Vereine) muss in der Anwendungslogik durchgesetzt werden, nicht nur
  in der DB.

---

# ADR-0002: Companion-Goal-Event statt Consumer-Erweiterung bei `shot`+`outcome='goal'`

## Datum

2026-08-16

---

## Status

Akzeptiert

---

## Kontext

Phase 3 (Schuss-Tracking) führt einen `shot`-Event-Typ mit `outcome ∈
{goal, save, miss, block}` ein (statt vier separater Typen, siehe
Architektur-Dokument Abschnitt 9). Ein Schuss mit `outcome='goal'`
ist fachlich ein Tor – aber `calculateMatchScore`,
`getRosterStats`, der PDF-Spielbericht und `GamePage.jsx`s
Live-Scoreboard sind alle bereits gebaut und getestet gegen
`event_type='goal'`.

---

## Entscheidung

Bei `eventType='shot' AND outcome='goal'` erzeugt der Server
zusätzlich, in derselben Transaktion, ein schlankes Companion-
`goal`-Event (nur Attribution/Zeitpunkt kopiert, kein Schuss-Detail).
Verknüpfung über `metadata.companionGoalEventId` (bestehende JSONB-
Spalte). `deleteEvent` löscht ein verknüpftes Companion-Event mit.

---

## Alternativen

### Bestehende Konsumenten auf `shot`+`outcome='goal'` erweitern

Vorteile: keine doppelte Zeile in `game_events`.

Nachteile: vier bereits verifizierte, produktiv laufende Code-Stellen
müssten geändert werden (`calculateMatchScore`, `getRosterStats`,
`pdfExportController.js`, `GamePage.jsx`) – höheres Regressionsrisiko
für eine Phase, die additiv bleiben soll.

---

## Begründung

Ein neuer, isolierter Insert-Pfad ist risikoärmer als vier
Änderungen an bereits getesteten, produktiven Stellen. Der
`shot`-Datensatz bleibt der einzige detaillierte Datenpunkt (Companion
bewusst ohne `x`/`y`/`zone`/`shot_type`), damit eine spätere naive
Zonen-Auswertung über ALLE `event_type='goal'`-Zeilen nicht doppelt
zählt.

---

## Konsequenzen

Vorteile:

* Bestehende Score-/Statistik-Logik bleibt unverändert und
  unwissend vom neuen `shot`-Typ.
* Löschung bleibt konsistent (Companion wird mitgelöscht, beide im
  Audit-Log).

Nachteile:

* `addEvent`/`deleteEvent` mussten transaktional umgebaut werden
  (`pool.connect()`/`BEGIN`/`COMMIT`/`ROLLBACK`).
* Ein per Schuss-Tracking erfasstes Tor erzeugt zwei Zeilen in
  `game_events` statt einer – muss in der Zeitleisten-Anzeige gefiltert
  werden (siehe `GamePage.jsx`/`pdfExportController.js`).

---

# ADR-0003: `secondary_roster_player_id` für Torhüter-Zuordnung bei Gegner-Schüssen

## Datum

2026-08-16

---

## Status

Akzeptiert

---

## Kontext

Phase 3 braucht eine Möglichkeit, bei einem Gegner-Schuss
(`is_opponent=true`) optional festzuhalten, welcher unserer
Torhüter den Schuss gehalten/kassiert hat – Grundlage für einfache
Torhüter-Statistiken (Save %).

---

## Entscheidung

Verwendung des bestehenden, bereits vorhandenen Feldes
`secondary_roster_player_id` (Phase 1) statt `roster_player_id` oder
einer neuen Spalte. Bedeutung je `is_opponent`: bei `false` künftig
"Assist" (noch ungenutzt), bei `true` "unser Torhüter".

---

## Alternativen

### `roster_player_id` verwenden

Nachteile: **technisch nicht möglich** – die bestehende, seit Phase 1
unveränderte Regel in `addEvent` lehnt `rosterPlayerId && isOpponent`
mit 400 ab (ein Ereignis kann nicht gleichzeitig einem eigenen
Kader-Spieler und dem Gegner zugeordnet sein). Diese Regel zu
lockern hätte die bestehende, semantisch klare Bedeutung von
`roster_player_id` ("unser Spieler, der diese Aktion ausgeführt hat")
aufgeweicht.

### Neue Spalte `goalkeeper_roster_player_id`

Vorteile: explizit benannt, keine Doppelbedeutung.

Nachteile: neue Migration für ein Feld, dessen Bedeutung sich exakt
mit dem bereits vorhandenen "Zweitbeteiligter"-Konzept deckt – eine
zusätzliche Spalte für denselben fachlichen Zweck (jemand zweites,
der an diesem Ereignis beteiligt war) wäre Redundanz.

---

## Begründung

`secondary_roster_player_id` ist bereits nullable, bereits
scope-geprüft, und "Zweitbeteiligter" ist fachlich exakt zutreffend
für beide Bedeutungen (Assist bei eigenem Tor, Torhüter bei
Gegnertor) – keine Kollision, da ein Ereignis nie beides gleichzeitig
sein kann (`is_opponent` entscheidet eindeutig).

---

## Konsequenzen

Vorteile:

* Keine neue Migration/Spalte nötig.
* `calculateGoalkeeperStats` gruppiert einfach nach diesem Feld,
  gefiltert auf `is_opponent=true`.

Nachteile:

* Die Doppelbedeutung des Feldes muss an jeder Verwendungsstelle
  dokumentiert bleiben (siehe Code-Kommentare in
  `gameEventsController.js`, `docs/statistics.md`), sonst ist sie nicht
  selbsterklärend.

---

# ADR-0004: Special-Teams-Kräfteverhältnis – Vereinfachungsmodell und serverseitige Ableitung

## Datum

2026-08-17

---

## Status

Akzeptiert

---

## Kontext

Phase 4 braucht Powerplay-%/Penalty-Kill-% sowie ein `strengthState`
(`even`/`powerplay`/`shorthanded`) je Ereignis. Das exakte
Floorball-Regelwerk für Strafzeiten (Perioden-übergreifende
Fortsetzung, Bank-Minor bei Matchstrafen, echtes Verschmelzen
überlappender Strafintervalle zu einer einzigen "Gelegenheit") ist
komplex und ohne verlässliche, vollständige Datenbasis (z.B. exakte
Restzeit bei Perioden-Wechsel, offizielle Ahndung von
Matchstrafen-Ersatzspielern) nicht fehlerfrei nachbaubar. Die
Anforderung selbst verbietet erfundene Präzision.

Zusätzlich war `strengthState` seit Phase 1 ein vom Client
sendbares, aber nirgends tatsächlich befülltes Feld (kein
Frontend-Code setzte es) – Phase 4 musste entscheiden, ob es
client-seitig bleibt oder wie `period`/`clockSecondsAtEvent`
serverseitig übernommen wird.

---

## Entscheidung

1. **Kein Perioden-übergreifendes Strafzeitfenster.** Ein
   Strafzeitfenster wird am Periodenende gekappt
   (`min(start + Dauer, periodEndSeconds)`), nicht in die nächste
   Periode fortgesetzt.
2. **`match_penalty` erzeugt kein Zeitfenster.** Ohne verlässliche
   Dauer/Ersatzspieler-Regel wird keine Kräfteverhältnis-Auswirkung
   simuliert.
3. **Gelegenheiten werden pro Strafe gezählt**, nicht durch
   Verschmelzen überlappender/angrenzender Strafintervalle zu einer
   gemeinsamen Gelegenheit.
4. **`strengthState` wird vollständig serverseitig abgeleitet** (wie
   `period`/`clockSecondsAtEvent` seit Phase 1) statt vom Client
   akzeptiert – `req.body.strengthState` wird ignoriert, der
   Validator dafür entfernt.

---

## Alternativen

### Exakte Intervall-Verschmelzung überlappender Strafen

Vorteile: fachlich präziser bei mehreren gleichzeitigen Strafen.

Nachteile: deutlich komplexere Logik (Intervall-Merge-Algorithmus),
für einen Randfall (mehrere gleichzeitige Strafen desselben Teams),
der in der Praxis selten ist – Mehraufwand ohne proportionalen Nutzen,
und schwerer nachvollziehbar/dokumentierbar für Trainer als "eine
Strafe = eine Gelegenheit".

### Perioden-übergreifende Fortsetzung

Vorteile: bildet die reale Regel ab, dass eine Strafe über die
Drittelpause hinaus andauern kann.

Nachteile: erfordert zusätzliche Annahmen darüber, wie Pausenzeit
gezählt wird (real verstrichene Zeit vs. Spieluhr) – ohne verlässliche
Daten dazu wäre das Ergebnis geraten, nicht abgeleitet.

### `strengthState` client-seitig belassen

Vorteile: kein Server-Query pro Event.

Nachteile: kein Frontend-Code setzt das Feld je (verifiziert), es
wäre dauerhaft `null`/unbenutzt geblieben – inkonsistent mit dem
etablierten Muster, dass ableitbare Felder serverseitig berechnet
werden (`period`, `clockSecondsAtEvent`, `zone`).

---

## Begründung

Diese Vereinfachungen sind bewusste, dokumentierte Näherungen statt
stillschweigend erfundener Präzision – konsistent mit dem Prinzip
"unbekannt ≠ 0" und der expliziten Anforderung, keine Genauigkeit
vorzutäuschen, die die Datenlage nicht hergibt. Alle drei
Strafzeit-Vereinfachungen sind in `docs/statistics.md` unter
"Special Teams" explizit als Einschränkungen benannt, nicht versteckt.

Die serverseitige Ableitung von `strengthState` folgt demselben
bereits etablierten Muster wie `period`/`clockSecondsAtEvent`
(Phase 1) und `zone` (Phase 3) – der Server ist die einzige
verlässliche Quelle für aus anderen Ereignissen abgeleitete Felder.

---

## Konsequenzen

Vorteile:

* Einfache, nachvollziehbare, testbare Logik
  (`calculateSpecialTeamsStats`, `computeStrengthState`).
* `strengthState` ist ab sofort für jedes Ereignis korrekt und
  konsistent befüllt, unabhängig vom Frontend-Client.
* Rückwärtskompatibel: `calculateSpecialTeamsStats` berechnet
  Strafzeitfenster direkt aus rohen `penalty_2`/`penalty_5`-Zeilen
  neu, nicht aus der gespeicherten `strength_state`-Spalte – Spiele
  aus Phase 1–3 (dort `strength_state` NULL) liefern trotzdem
  korrekte Special-Teams-Statistiken.

Nachteile:

* **API-Contract-Änderung**: ein vom Client gesendetes
  `strengthState` wird ab Phase 4 stillschweigend ignoriert (siehe
  `CHANGELOG.md`). Da kein ausgelieferter Frontend-Code dieses Feld
  je gesetzt hat, kein tatsächlicher Breaking Change für die
  ausgelieferte UI.
* Kanten-Situationen wie eine über die Drittelpause andauernde Strafe
  oder mehrere sich überlappende Strafen desselben Teams werden
  bewusst ungenau (konservativ) abgebildet – dokumentiert, nicht
  verschwiegen.

---

# ADR-0005: Video-Integration – eigene `game_videos`-Tabelle statt `game_id` an `board_videos`

## Datum

2026-08-21

---

## Status

Akzeptiert

---

## Kontext

Phase 6 verbindet Match-Videos mit `game_events` ("Event → Video
springen", `videoTimestampSeconds` existiert seit Phase 1 als
vorbereitete, bis dahin ungenutzte Spalte). Board-Videos
(`board_videos`) und Spiele/Ereignisse (`games`/`game_events`) waren
bis Phase 6 vollständig getrennte Subsysteme ohne jede Verbindung.

Die Roadmap (`STATISTICS_ANALYTICS_ARCHITECTURE.md`, Abschnitt 11)
nannte zwei mögliche Wege: `game_id` an `board_videos` anhängen, oder
eine neue Verknüpfungstabelle. Beide Wege mussten gegen die in
Abschnitt 5 desselben Dokuments festgehaltenen Muster geprüft werden:

* Vorlagen-Ressourcen (`roster_players`, `lines`, `board_videos`)
  scopen direkt über `team_id`/`board_id`.
* Spielbezogene Ressourcen (`game_events`, `game_squad`, `match_lines`)
  scopen transitiv über `game_id` und nutzen `assertGameRead`/
  `assertGameWrite`, nicht `assertBoardAccess`.

`board_videos` gehört klar zur ersten Gruppe (Board-Zugriffsmodell:
Owner + Kollaboratoren mit read/write), Spiel-Videos klar zur
zweiten (Team-Zugriffsmodell: Owner + Team-Mitglieder mit
member/coach-Rollen). Diese beiden Zugriffsmodelle sind strukturell
unterschiedlich genug, dass ein gemeinsamer Controller sie hätte
verzweigen müssen.

---

## Entscheidung

1. **Neue, eigenständige Tabelle `game_videos`**, strukturell
   identisch zu `board_videos` (gleiche Spalten: Zeichnungs-Überlagerung,
   Trim-Grenzen, Szenen-Marken, gleiche Disk-Ablage über `VIDEOS_DIR`),
   aber mit `game_id` statt `board_id` und darüber transitivem
   Team-Scoping über `assertGameRead`/`assertGameWrite` statt
   `assertBoardAccess`. Eigener Controller
   (`gameVideosController.js`), der `videoController.js` bewusst
   spiegelt statt eine gemeinsame Abstraktion einzuführen – folgt dem
   bestehenden, in Abschnitt 5 der Architektur-Doku dokumentierten
   Muster "Zugriffsprüfung pro Controller dupliziert, kein
   Refactoring nebenbei".
2. **`game_events.video_id`** (neu, `ON DELETE SET NULL`) referenziert
   `game_videos(id)` und macht damit erst eindeutig, zu WELCHEM Video
   ein `video_timestamp_seconds` gehört – ein Spiel kann mehrere
   Videos haben (z.B. erste/zweite Halbzeit, mehrere Kamerawinkel).
3. **Ein neuer, bewusst eng begrenzter Endpunkt**
   `PUT /api/games/:id/events/:eventId/video-link` erlaubt das
   nachträgliche Setzen/Entfernen NUR von `videoId`/
   `videoTimestampSeconds` an einem bereits bestehenden Ereignis –
   eine gezielte Ausnahme vom Grundsatz "kein Edit-Endpunkt für
   Ereignisse, bei Tippfehler löschen und neu erfassen"
   (`game_events`-Tabellenkommentar in `db/migrate.js`). Begründung:
   die Architektur-Doku fordert explizit, dass eine Video-Verknüpfung
   sowohl live als auch NACHTRÄGLICH beim Video-Review nach dem Spiel
   möglich sein muss – "löschen und neu erfassen" würde hier
   bedeuten, ein korrektes Tor-/Strafe-Ereignis zu löschen, nur um
   einen Video-Link zu ändern. Alle anderen Ereignisfelder
   (`eventType`, Zuordnung, `outcome`, …) bleiben weiterhin
   unveränderlich.

---

## Begründung

* Konsistent mit dem bereits etablierten Scoping-Muster für
  spielbezogene Ressourcen (kein neuer Präzedenzfall).
* Kein Vermischen zweier unterschiedlicher Zugriffsmodelle in einem
  Controller.
* `board_videos` bleibt unverändert (kein Risiko für bestehende
  Board-Video-Funktionalität).
* `VideoAnnotationOverlay.jsx` (Zeichnen/Trimmen/Marken) bleibt
  vollständig wiederverwendbar für Spiel-Videos – die
  Ereignis-Verknüpfung ist dort ein rein optionaler Zusatz
  (`linkableEvents`/`onLinkEvent`/`onUnlinkEvent`/`onSeekReady`),
  Board-Nutzung bleibt unverändert.

---

## Folgen

* Zwei strukturell sehr ähnliche Tabellen/Controller
  (`board_videos`/`videoController.js` und
  `game_videos`/`gameVideosController.js`) existieren bewusst
  parallel statt einer gemeinsamen Abstraktion – etwas Duplikation,
  aber klar getrennte, unabhängig veränderbare Zugriffsmodelle. Sollte
  künftig ein drittes Video-Trägerobjekt hinzukommen, ist an dieser
  Stelle eine Abstraktion neu zu bewerten.
* `game_events` hat mit `video_id` erstmals eine Fremdschlüssel-Spalte
  auf eine andere Ressource als `roster_players`/`games` selbst –
  unproblematisch, da `ON DELETE SET NULL` das Ereignis von der
  Videodatei entkoppelt hält.

---

# Regel

Architekturentscheidungen werden nicht vergessen.

Sie werden dokumentiert.
