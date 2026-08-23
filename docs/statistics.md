# Statistik-Definitionen

> Jede Kennzahl in OpenFloorball wird zentral in
> `backend/src/services/statisticsEngine.js` bzw. den unten genannten
> SQL-Abfragen berechnet – niemals im Frontend neu erfunden. Diese
> Seite dokumentiert Formel, Datenbedarf und Einschränkungen jeder
> Kennzahl (Anforderung: "Definiere die Berechnung, bevor du sie
> implementierst"). Hintergrund/Architektur:
> [docs/planning/STATISTICS_ANALYTICS_ARCHITECTURE.md](./planning/STATISTICS_ANALYTICS_ARCHITECTURE.md).

---

## Bereits implementiert

### Live-Spielstand

**Definition:** Anzahl eigener Tore gegen Anzahl gegnerischer Tore
für ein einzelnes Spiel.

**Formel:**
```
ownGoals      = COUNT(game_events WHERE event_type = 'goal' AND is_opponent = false)
opponentGoals = COUNT(game_events WHERE event_type = 'goal' AND is_opponent = true)
```

**Benötigte Daten:** `game_events` mit `event_type='goal'`.

**Einschränkungen:** Ein Tor ohne Spielerzuordnung (kein
`roster_player_id`, `is_opponent=false`) zählt korrekt fürs
Team-Ergebnis, aber für keine Einzelspieler-Statistik (siehe unten).

**Implementierung:** `backend/src/services/statisticsEngine.js`
(`calculateMatchScore`), verwendet von `pdfExportController.js`
(Spielbericht). Frontend (`GamePage.jsx`) rechnet für die
optimistische Live-Anzeige dieselbe Formel client-seitig nach, um
nicht auf einen Server-Roundtrip zu warten – kanonische Quelle bleibt
die Engine.

---

### Tore pro Spieler (Saison)

**Definition:** Summe aller eigenen Tore eines Kader-Spielers über
alle Spiele hinweg.

**Formel:**
```
goals = SUM(game_events WHERE event_type = 'goal' AND is_opponent = false
            GROUP BY roster_player_id)
```

**Benötigte Daten:** `game_events.roster_player_id`.

**Einschränkungen:** Nicht zuordenbare Tore (kein `roster_player_id`)
fließen NICHT in diese Zahl ein – sie erhöhen nur den Team-Spielstand.

**Implementierung:** `backend/src/controllers/rosterController.js`
(`getRosterStats`).

---

### Assists und Punkte pro Spieler (Saison)

> ✅ Umgesetzt (Phasenplanungs-Review 2026-08-21). `secondary_roster_player_id`
> existierte bereits seit Phase 1 für genau diesen Zweck, wurde aber nie
> ausgewertet – siehe Review-Notiz in `docs/planning/BACKLOG.md`
> (EPIC 012).

**Definition:** Anzahl Tore, bei denen dieser Spieler als Vorlagengeber
(Assist) hinterlegt wurde; Punkte = Tore + Assists.

**Formel:**
```
assists = SUM(game_events WHERE event_type = 'goal' AND is_opponent = false
              GROUP BY secondary_roster_player_id)
points  = goals + assists   -- zur Anzeigezeit berechnet, keine eigene Spalte
```

Das `AND is_opponent = false` ist zwingend: `secondary_roster_player_id`
hat bei einem Gegner-Ereignis eine andere Bedeutung ("unser Torhüter",
siehe ADR-0003) und darf nicht als Assist mitgezählt werden.

**Benötigte Daten:** `game_events.secondary_roster_player_id` auf einem
`event_type='goal'`-Ereignis. Erfassbar über zwei Wege:
1. Direkt beim einfachen "Tor"-Preset (API unterstützt
   `secondaryRosterPlayerId` seit Phase 1, aktuell kein UI-Feld dafür –
   bewusst, siehe unten).
2. Über "Schuss erfassen" (Statistik-Architektur Phase 3) bei
   `outcome='goal'`: die Assist-Auswahl im `ShotEntryPanel.jsx`. Das
   Companion-Goal-Event (ADR-0002) kopiert `secondary_roster_player_id`
   seither mit, da diese Kennzahl aus `event_type='goal'` liest, nicht
   aus `shot`.

**Einschränkungen:** Bewusst KEIN Assist-Feld beim schnellen "Tor"-Preset
in `GamePage.jsx` – dieser Pfad bleibt absichtlich der schnelle,
detailfreie Weg (gleiches Prinzip wie beim Schuss-Tracking). Ein Assist
lässt sich nur über "Schuss erfassen" eingeben.

**Implementierung:** `backend/src/controllers/rosterController.js`
(`getRosterStats`, `getRosterPlayerGameLog`),
`frontend/src/components/shotTracking/ShotEntryPanel.jsx`.

---

### Strafminuten pro Spieler (Saison)

**Definition:** Summe der Strafminuten eines Spielers über alle
Spiele hinweg.

**Formel:**
```
penalty_minutes = SUM(
  CASE WHEN event_type = 'penalty_2' THEN 2
       WHEN event_type = 'penalty_5' THEN 5
       ELSE 0 END
) GROUP BY roster_player_id
```

**Benötigte Daten:** `game_events` mit `event_type IN ('penalty_2','penalty_5')`.

**Einschränkungen:** Matchstrafen fließen NICHT in Strafminuten ein
(eigene Kennzahl, siehe unten) – eine Matchstrafe hat keine feste
Minutenzahl in diesem Modell.

**Implementierung:** `rosterController.js` (`getRosterStats`).

---

### Matchstrafen pro Spieler (Saison)

**Definition:** Anzahl der Matchstrafen eines Spielers über alle
Spiele hinweg.

**Formel:** `COUNT(game_events WHERE event_type = 'match_penalty' GROUP BY roster_player_id)`

**Implementierung:** `rosterController.js` (`getRosterStats`).

---

### Einsätze pro Spieler (Saison)

**Definition:** Anzahl der Spiele, in denen ein Spieler als
`playing` im Matchkader stand.

**Formel:** `COUNT(game_squad WHERE status = 'playing' GROUP BY roster_player_id)`

**Benötigte Daten:** `game_squad`.

**Einschränkungen:** Zählt nur den Kader-Status, nicht die
tatsächliche Eiszeit/Time-on-Floor – dafür fehlt bis Phase 2
(Shift-Tracking über `match_lines`) die Datengrundlage. **Unbekannt ≠
0**: Ein Spieler ohne jeden `game_squad`-Eintrag für ein Spiel hat
`appearances = 0` für dieses Spiel, weil er nachweislich nicht im
Kader stand – das ist ein echtes Zählergebnis, kein "unbekannt"-Fall
(anders als z.B. Time-on-Floor ohne Shift-Tracking).

**Implementierung:** `rosterController.js` (`getRosterStats`).

---

### Zeit zusammen (Time on Floor je Line)

**Definition:** Summe der Zeit, die eine Line während eines Spiels
tatsächlich "auf dem Feld" war (nicht: wie lange sie als Vorlage
existiert – siehe `lines.is_active`, das ein reines
Vorbereitungs-Flag ohne Spielbezug ist).

**Formel:** Für jede geschlossene `match_lines`-Zeile (`ended_at`
gesetzt): `ended_at - started_at`, aufsummiert je `line_id`
(Fallback `line_name`, falls die Vorlage seither gelöscht wurde).
Zeitfenster sind **halb-offen** `[started_at, ended_at)` – beim
Line-Wechsel liefert Postgres' `NOW()` innerhalb derselben Transaktion
für das Schließen der alten und das Öffnen der neuen Zeile denselben
Zeitstempel, wodurch der Übergang lückenlos ist.

**Benötigte Daten:** `match_lines`.

**Einschränkungen:** **Unbekannt ≠ 0** – eine noch offene Zeile
(`ended_at IS NULL`, die Line ist gerade aktiv) trägt standardmäßig
NICHT zur Summe bei (kein geschätzter Endzeitpunkt wird in einen
gespeicherten Wert eingefroren); nur in der Live-Ansicht eines
laufenden Spiels wird sie bis zum aktuellen Zeitpunkt mitgezählt und
zusätzlich über `hasOpenShift: true` als vorläufig markiert. Eine
Line, die in diesem Spiel nie aktiviert wurde, taucht in der Liste gar
nicht auf (kein 0-Eintrag). **Keine Cross-Game-Exklusivität**: dieselbe
Line-Vorlage kann in zwei verschiedenen, gleichzeitig laufenden
Spielen offen sein – `match_lines` ist ein reines Spiel-Log, keine
Live-Sperre.

**Implementierung:** `backend/src/services/statisticsEngine.js`
(`calculateLineStats`), `GET /api/games/:id/match-lines/stats`.

---

### Goals For/Against je Line

**Definition:** Wie viele eigene bzw. gegnerische Tore fielen,
während eine bestimmte Line auf dem Feld war.

**Formel:** Für jedes Tor-Ereignis (`event_type = 'goal'`): fällt sein
`created_at` in das halb-offene Zeitfenster `[started_at, ended_at)`
einer `match_lines`-Zeile, wird es je nach `is_opponent` zu
`goalsFor`/`goalsAgainst` dieser Line gezählt.

**Benötigte Daten:** `match_lines`, `game_events`.

**Einschränkungen:** Ein Tor, das VOR der ersten Line-Aktivierung
eines Spiels fällt, wird keiner Line zugeordnet (dokumentierte Lücke,
kein Fehler). Bei einer offenen Zeile gilt dieselbe "unbekannt ≠
0"-Regel wie bei der Zeit-Kennzahl oben – ohne `now`-Parameter werden
Tore während einer noch offenen Zeile nicht gezählt.

**Implementierung:** wie oben, `calculateLineStats`.

---

### Line-Chemie (Saison)

> ✅ Umgesetzt (Statistik-Architektur Phase 8, Advanced Analytics).

**Definition:** Dieselben zwei Kennzahlen wie oben (Zeit zusammen,
Goals For/Against je Line), aber aggregiert über ALLE Spiele des
Nutzers statt eines einzelnen.

**Formel:** identisch zu `calculateLineStats` oben – die Funktion war
von Anfang an spielunabhängig gehalten (nimmt beliebige
`match_lines`/`game_events`-Zeilen entgegen), eine Saison-Aggregation
ist daher schlicht derselbe Aufruf mit Zeilen aus allen sichtbaren
Spielen statt nur eines.

**Benötigte Daten:** wie oben, aber `WHERE game_id IN (alle Spiele des
Nutzers)` statt eines einzelnen `game_id`.

**Einschränkungen:** `now` wird hier bewusst NICHT gesetzt (anders als
bei der Live-Ansicht eines einzelnen Spiels) – eine gerade offene Zeile
aus einem laufenden Spiel würde sonst einen vom Abrufzeitpunkt
abhängigen, nicht reproduzierbaren Wert einfrieren. Sie zählt daher
erst nach dem nächsten Linienwechsel mit.

**Implementierung:** `matchLinesController.getSeasonLineStats`,
`frontend/src/components/lineStats/SeasonLineChemieSection.jsx` (auf
`/lines`).

---

### Schuss-% (Shot %)

**Definition:** Anteil der Schüsse aufs Tor, die zu einem Treffer
wurden – bewusst NICHT bezogen auf alle Schüsse (siehe Formel).

**Formel:** `goals / shotsOnGoal`, wobei `shotsOnGoal = COUNT(shot
WHERE outcome IN ('goal','save'))`. `miss`/`block`-Schüsse hätten nie
eine echte Torchance für den Torhüter dargestellt und würden die
Kennzahl sonst mit reiner Zielgenauigkeit vermengen – Standard-
Konvention (Eishockey wie Floorball).

**Benötigte Daten:** `game_events` mit `event_type='shot'`.

**Einschränkungen:** "unbekannt ≠ 0" – ohne Schüsse aufs Tor bleibt
`shotPercentage: null`, nie `0`. Erst sinnvoll interpretierbar mit
ausreichender Fallzahl (Sample Size, siehe Konventionen unten).

**Implementierung:** `statisticsEngine.js` (`calculateShotStats`),
`GET /api/games/:id/events/shot-stats`, Saison-Aggregat in
`rosterController.getRosterStats`, angezeigt in `GamePage.jsx`
(`ShotStatsSection`) und `StatsPage.jsx`.

---

### Zonen-Taxonomie (floorball-eigen)

**Definition:** 5 Zonen, aus denen ein Schuss abgegeben wurde –
bewusst NICHT aus dem Eishockey übernommen (kein "Slot"/"Point"/
"blaue Linie"), sondern eine einfache, dokumentierte
Schema-Näherung für Floorball. `x∈[0,1]` = Nähe zum beschossenen Tor
(1=am Tor), `y∈[0,1]` = quer zur Torbreite.

| Zone | Bedingung |
|---|---|
| Nahzone Zentrum | `x≥0.72 AND 0.35≤y≤0.65` |
| Nahzone Links | `x≥0.72 AND y<0.35` |
| Nahzone Rechts | `x≥0.72 AND y>0.65` |
| Halbdistanz | `0.40≤x<0.72` |
| Distanz | `x<0.40` |

`0.72`/`0.40` orientieren sich grob am IFF-Torraum (5 m Tiefe)
relativ zu einem Diagramm, das ungefähr das letzte Angriffsdrittel
abbildet – eine Schema-Näherung, keine exakte Feldvermessung.

**Implementierung:** `deriveZone(x, y)` – bewusst dupliziert in
`backend/src/services/statisticsEngine.js` UND
`frontend/src/constants/shotZones.js` (kein Shared-Package zwischen
Backend/Frontend, gleiche Toleranz wie z.B. `toDateString`). Der
Server befüllt `zone` automatisch aus `x`/`y`, falls der Client keine
mitschickt; eine explizit vom Client gesetzte `zone` hat Vorrang.

---

### Torhüter-Fangquote (Save %)

**Definition:** Anteil der Gegner-Schüsse aufs Tor, die ein
bestimmter Torhüter gehalten hat.

**Formel:** `saves / shotsOnGoalAgainst`, wobei `shotsOnGoalAgainst =
COUNT(shot WHERE is_opponent=true AND outcome IN ('goal','save'))`,
gruppiert nach `secondary_roster_player_id`.

**Benötigte Daten:** `game_events` mit `event_type='shot' AND
is_opponent=true`. **Wichtiger Hinweis zur Feldwahl:** die
Torhüter-Zuordnung läuft über `secondary_roster_player_id`, NICHT
`roster_player_id` – Letzteres ist durch die bestehende Regel
"`rosterPlayerId` und `isOpponent` nie gleichzeitig" blockiert (siehe
ADR-0003 in `docs/planning/DECISIONS.md`).

**Einschränkungen:** "unbekannt ≠ 0" – ohne Schüsse aufs Tor bleibt
`savePercentage: null`. Ein Gegner-Schuss ohne zugeordneten Torhüter
zählt für den Live-Spielstand/die Team-Schuss-Statistik, aber in
keine Einzel-Torhüter-Zeile. Saison-Aggregat (`StatsPage.jsx`) zeigt
Torhüter-Spalten nur für Spieler mit `role='TW'` – eine versehentliche
Zuordnung bei einem Nicht-Torhüter erzeugt daher keine irreführende
Fangquote.

**Implementierung:** `statisticsEngine.js`
(`calculateGoalkeeperStats`), `GET /api/games/:id/events/goalkeeper-stats`,
`GamePage.jsx` (`GoalkeeperStatsSection`), `StatsPage.jsx`.

---

### Special Teams: Powerplay-% / Penalty-Kill-%

**Definition:** Erfolgsquote bei eigenem Zahlenvorteil (Powerplay)
bzw. eigener Unterzahl (Penalty Kill).

**Formel:** `Powerplay-% = PP-Tore / PP-Gelegenheiten`,
`Penalty-Kill-% = (PK-Gelegenheiten − Gegentore in Unterzahl) /
PK-Gelegenheiten`. `strength_state` (`even`/`powerplay`/`shorthanded`)
wird serverseitig bei JEDEM Ereignis automatisch aus aktiven
`penalty_2`/`penalty_5`-Strafen berechnet (siehe
`gameEventsController.computeStrengthState`); die Aggregat-Kennzahl
selbst wird jedoch unabhängig davon direkt aus den rohen
Strafen-Zeitfenstern neu berechnet (Rückwärtskompatibilität mit vor
Phase 4 erfassten Spielen, deren `strength_state` NULL ist).

**Benötigte Daten:** `game_events` mit `event_type IN ('penalty_2',
'penalty_5')` und `event_type='goal'`.

**Einschränkungen (bewusste Vereinfachungen, siehe ADR-0004 in
`docs/planning/DECISIONS.md`):**
- Strafenfenster werden am Periodenende gekappt, nicht über Perioden
  hinweg fortgesetzt – ein Vorteil, der über eine Drittelpause
  hinausreicht, wird nicht abgebildet.
- `match_penalty` erzeugt kein Fenster (keine verlässliche
  Dauer/Bank-Minor-Regel modellierbar, ohne Präzision vorzutäuschen).
- Gelegenheiten werden PRO STRAFE gezählt, nicht durch Verschmelzen
  überlappender/angrenzender Strafintervalle – zwei Gegner-Strafen,
  die beide beginnen, während wir keine eigene aktive Strafe haben,
  zählen als 2 separate Gelegenheiten, auch wenn ein Unparteiischer
  das ggf. als einen durchgehenden Vorteil werten würde.
- `percentage: null` statt `0` bei 0 Gelegenheiten.

**Implementierung:** `statisticsEngine.js`
(`calculateSpecialTeamsStats`, `PENALTY_DURATIONS_SECONDS`),
`GET /api/games/:id/events/special-teams-stats`, `GamePage.jsx`
(`SpecialTeamsStatsSection`).

---

### Situations-Splits: nach Spielstand und nach Periode

**Definition:** Tore (und, sofern Schuss-Tracking genutzt wird,
Schüsse/Schuss-%) aufgeschlüsselt danach, ob das Team zum Zeitpunkt
des Ereignisses in Führung, im Rückstand oder unentschieden stand,
sowie nach Spieldrittel.

**Formel:** Chronologischer Durchlauf aller Ereignisse (sortiert nach
`created_at`); jedes Ereignis wird nach dem Spielstand VOR ihm
klassifiziert, Tor-Tallies werden erst danach aktualisiert.

**Benötigte Daten:** `game_events` (`event_type='goal'` für die
Spielstand-Tallies, `event_type='shot'` für die Schuss-Teilmetriken,
`period` für die Perioden-Gruppierung).

**Einschränkungen:** `ownGoals`/`opponentGoals` zählen ALLE
`goal`-Events (auch vom klassischen "Tor"-Preset ohne
`shot`-Unterbau) – nur die Schuss-Teilmetriken kommen ausschließlich
aus `shot`-Events und bleiben bei Spielen ohne Schuss-Tracking-Nutzung
auf 0. Ereignisse ohne `period` (Uhr nie gestartet) landen in einem
eigenen "unbekannt"-Bucket statt verworfen zu werden.

**Implementierung:** `statisticsEngine.js`
(`calculateSituationalStats`), `GET /api/games/:id/events/situational-stats`,
`GamePage.jsx` (`SituationalStatsSection`).

---

### Trends: Spiel-für-Spiel-Verlauf

**Definition:** Rohzahlen (Tore/Schüsse/Strafminuten) je Spiel für
einen Kader-Spieler, chronologisch, als Grundlage für Last-5/
Last-10/Saison-Vergleiche.

**Formel:** Fenster-Aggregation summiert Rohzahlen ZUERST (z.B.
`shotGoals`/`shotsOnGoal` über alle Spiele des Fensters), dividiert
erst danach (`shotPercentage = Summe shotGoals / Summe shotsOnGoal`)
– ein Durchschnitt bereits pro Spiel berechneter Prozentwerte wäre
mathematisch falsch.

**Benötigte Daten:** `games` (`played_at`), `game_squad`
(`status='playing'`), `game_events`.

**Einschränkungen:** Spiele ohne `played_at` werden ausgeschlossen
(keine verlässliche Chronologie möglich). Keine Chart-Bibliothek
verwendet – eine einfache CSS-Breiten-Balken-Darstellung (Tore je
Spiel) statt eines Diagramm-Frameworks (keine neue Abhängigkeit).

**Implementierung:** `GET /api/roster/:id/game-log`
(`rosterController.getRosterPlayerGameLog`), `PlayerTrendsPage.jsx`
(`aggregateWindow`), `GameLogBars.jsx`.

---

### Spieler-Vergleich

Reine Frontend-Wiederverwendung der bereits vorhandenen
Saison-Kennzahlen (`GET /api/roster/stats`) – keine neue Formel,
keine neue Backend-Route. Bis zu 4 Spieler gleichzeitig als
transponierte Tabelle gegenübergestellt (`StatsPage.jsx`,
`PlayerComparisonSection.jsx`).

---

### Gegner-Bilanz (Siege/Unentschieden/Niederlagen, Tordifferenz)

> ✅ Umgesetzt (2026-08-23, strukturierte Gegner-Entität, ADR-0007 in
> `DECISIONS.md`).

**Definition:** Über alle Spiele gegen denselben Gegner hinweg (siehe
`opponents`-Tabelle, per Name automatisch verknüpft): Anzahl
Siege/Unentschieden/Niederlagen sowie Tore für/gegen, aus Sicht des
eigenen Teams.

**Formel:** `calculateMatchScore(eventRows)` (Statistics Engine, ADR-
0001) je Spiel, danach `ownGoals > opponentGoals` → Sieg,
`ownGoals < opponentGoals` → Niederlage, sonst Unentschieden.
Aufsummiert über alle Spiele desselben `opponent_id`.

**Benötigte Daten:** `opponents`, `games` (`opponent_id`, `played_at`),
`game_events`.

**Einschränkungen:** Spiele ohne `played_at` zählen nicht in die
Bilanz (gleiche Konvention wie bei den Trends oben) – ein noch nicht
gespieltes, zukünftiges Spiel wäre sonst fälschlich ein
0:0-Unentschieden. Tippfehler-Duplikate gleichnamiger Gegner (z.B. "FC
Bern" vs. "SC Bern") bleiben getrennte Datensätze – kein automatisches
oder manuelles Zusammenführen in dieser Version.

**Implementierung:** `GET /api/opponents`
(`opponentsController.getOpponents`), `OpponentsPage.jsx`.

---

## Konventionen für alle künftigen Kennzahlen

1. **Nicht speichern, was aus Events berechenbar ist.** Vor jeder
   neuen Spalte prüfen, ob eine SQL-Aggregation über bestehende
   Events reicht.
2. **Unbekannt ≠ 0.** Fehlt die Datengrundlage für eine Kennzahl
   (z.B. Time on Floor ohne Shift-Tracking), wird `null`/"unbekannt"
   zurückgegeben, nie `0`.
3. **Sample Size immer mitliefern.** Jede `/60`-Kennzahl wird als
   `{ value, per60, sampleSeconds }` zurückgegeben, nie als nackte
   Zahl – kleine Stichproben dürfen nicht wie belastbare Aussagen
   wirken (Anforderung §61/62).
4. **Kein erfundenes xG.** Ein xG-Modell wird erst gebaut, wenn genug
   Schussdaten mit `outcome`/`shotType`/Position vorliegen, und dann
   versioniert (`xG Model v1.0`, siehe ADR-Format in
   `docs/planning/DECISIONS.md`) und nachvollziehbar dokumentiert.
5. **Abgeleitete Kennzahlen ersetzen nie das Rohereignis-Log.** Jede
   Statistikseite muss bei Bedarf auf die zugrunde liegenden Events
   zurückführbar sein (Explainable-AI-Prinzip, `CLAUDE.md` §5.10/18.3).
