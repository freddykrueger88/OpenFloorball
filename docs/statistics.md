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
Kein Assist-Konzept vorhanden vor Phase 1 – ab Phase 1 technisch
möglich (`secondary_roster_player_id`), aber noch nicht in einer
Statistikseite ausgewertet (siehe unten).

**Implementierung:** `backend/src/controllers/rosterController.js`
(`getRosterStats`).

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

## Ab Phase 1 möglich, noch nicht auf einer Statistikseite ausgewertet

Diese Formeln sind mit den in Phase 1 ergänzten `game_events`-Spalten
bereits berechenbar, sobald die entsprechende Erfassung (UI) und
Auswertung gebaut wird (Roadmap Phase 3+):

### Schuss-% (Shot %)

**Formel:** `goals / shots_on_goal_or_more` – benötigt `event_type='shot'`
mit `outcome IN ('goal','save','miss','block')`, gruppiert je nach
gewünschtem Nenner (z.B. nur `goal`+`save` für "Shots on Goal %").

**Benötigte Daten:** `game_events.outcome`, `game_events.shot_type`
(Phase 1 Spalten) – **noch keine Erfassungs-UI**, daher heute keine
Zeilen mit `event_type='shot'` vorhanden.

**Einschränkungen:** Erst sinnvoll interpretierbar mit ausreichender
Fallzahl (Sample Size) – siehe Abschnitt "Konventionen" unten.

### Assists

**Formel:** `COUNT(game_events WHERE event_type = 'goal' AND secondary_roster_player_id = :playerId)`

**Benötigte Daten:** `game_events.secondary_roster_player_id`
(Phase 1 Spalte) – noch keine UI, um beim Tor-Erfassen einen
Zweitspieler auszuwählen.

### Punkte (Points)

**Formel:** `goals + assists` – **wird nicht als eigene Spalte
gespeichert**, sondern zur Anzeigezeit aus den beiden obigen Werten
addiert (Anforderung §58: keine redundanten Felder).

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
