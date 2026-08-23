# 🏒 Live-Spielnotizen

Ein Spiel (Gegner + Datum, optional team-geteilt) anlegen und während
des laufenden Spiels schnelle, automatisch zeitgestempelte Notizen
erfassen – vom Handy aus, z. B. auf der Bank. Anders als
[Video-Marken](./Video-Integration.md) braucht es dafür kein
hochgeladenes Video: Notizen entstehen im Moment des Geschehens, nicht
erst bei der Nachbereitung.

## Spiel anlegen und Notizen erfassen

Unter `/games`:

1. Neues Spiel mit Gegner und Datum anlegen (beide optional), dabei
   wahlweise mit einem Team teilen (wie beim
   [Trainingsplaner](./Trainingsplaner.md) – lesen dürfen dann alle
   Team-Mitglieder, ändern nur Owner/Co-Trainer).
2. Auf der Spielseite über das große Eingabefeld Notizen eintippen und
   mit "Hinzufügen" bestätigen – bewusst ein einzelnes Textfeld statt
   eines Formulars, für schnelle Bedienung im Stehen.
3. Für die reglementierten Spielunterbrechungen nach IFF-Regelwerk
   (3 Drittel à 20 Min., eine Auszeit pro Team, Strafzeiten 2/5 Min.,
   Matchstrafe) gibt es Vorlagen-Buttons oberhalb des Eingabefelds –
   ein Tap trägt die Notiz direkt mit Zeitstempel ein, ohne tippen zu
   müssen. Die Buttons sind alphabetisch sortiert (sprachabhängig,
   die Reihenfolge unterscheidet sich also zwischen Deutsch/Englisch).
4. "Tor", "Strafzeit 2/5 Min." und "Matchstrafe" öffnen zusätzlich eine
   Zuordnungs-Auswahl aus dem [Kader](./Kader.md) des Spiels
   (team-geteilte Spiele: Kader dieses Teams, sonst der persönliche
   Kader) – jedes dieser Ereignisse betrifft immer eine Person, egal ob
   im eigenen Team oder beim Gegner. Neben dem Kader steht deshalb immer
   auch "Gegner" zur Auswahl, plus "Ohne Angabe" für den Fall, dass die
   Person unklar ist. Seit dem IFF-Regelwerk 2026 dürfen auch Torhüter
   ein Tor erzielen, die Auswahl filtert Rollen deshalb bewusst nicht.
5. Notizen erscheinen neueste zuerst, jeweils mit Uhrzeit (und bei
   team-geteilten Spielen mit dem Namen der Autorin/des Autors).

## Zugriff und Löschen

Eine Notiz kann von der Autorin/dem Autor selbst gelöscht werden oder
von jedem mit Schreibzugriff auf das Spiel (Owner/Co-Trainer) –
dieselbe Regel wie bei [Kommentaren](./Export.md). Ein Bearbeiten von
Notizen ist bewusst nicht vorgesehen: bei einem Tippfehler einfach
löschen und neu erfassen.

## Eigene Ereignistypen

Neben den festen IFF-Presets lässt sich unter den Vorlagen-Buttons ein
eigener Ereignistyp anlegen ("Eigenen Typ hinzufügen") – z. B. "Konter"
oder "Umschaltmoment", um taktisch interessante Momente in der
Zeitleiste zu markieren (und seit der [Video-Verknüpfung](#spielvideos-und-video-verknüpfung)
auch direkt mit einer Videoposition zu verbinden). Nur eine Bezeichnung
und optional "Braucht Zuordnung" (öffnet dann wie beim Tor-Preset die
Kader/Gegner-Auswahl) – kein Icon, keine Farbe, kein zweites
Schuss-Tracking-Formular, bewusst ein einfaches, schnelles Tag.

Ein eigener Typ gehört automatisch zu diesem Spiel: bei einem
team-geteilten Spiel allen Team-Mitgliedern (anlegen nur Owner/
Co-Trainer), bei einem persönlichen Spiel nur dir – er erscheint dann
auch nur bei Spielen desselben Teams bzw. bei deinen eigenen
persönlichen Spielen, nicht überall. Löschen ist jederzeit möglich,
solange der Typ noch in keinem Spiel verwendet wurde; danach wird er
beim Löschversuch automatisch deaktiviert statt entfernt (bereits
erfasste Ereignisse bleiben dadurch gültig und lesbar).

## Anwesenheit (RSVP)

Bei einem team-geteilten Spiel erscheint über den Notizen ein
"Anwesenheit"-Bereich: jedes Team-Mitglied sieht die volle Team-Liste
und kann für sich selbst mit Zusage/Absage/Unsicher antworten – auch
ohne Schreibzugriff auf das Spiel (eine Selbstauskunft braucht keine
Bearbeitungsberechtigung). Bei einer Absage lässt sich optional ein
Grund angeben (Schnellauswahl: Krank, Verletzt, Arbeit, Urlaub, Schule,
Privat, oder freier Text). Ohne Team-Zuordnung (persönliches Spiel)
gibt es keinen Empfängerkreis, der Bereich erscheint dann nicht. Gilt
identisch für [Trainingseinheiten](./Trainingsplaner.md).

## Spieluhr

Direkt unter dem Spielstand läuft eine echte Spieluhr: "Start" beginnt
Drittel 1 (und protokolliert automatisch einen Anstoß-Eintrag in der
Ereignis-Zeitleiste, genau wie ein manueller Tap auf den
Anstoß-Button), "Pause" hält an, "Nächstes Drittel" protokolliert
automatisch ein Drittelende für das auslaufende Drittel und setzt die
Uhr fürs nächste zurück. Ein Fortsetzen nach einer Pause erzeugt
**keinen** zweiten Anstoß-Eintrag. "Zurücksetzen" setzt nur die
Uhr-Anzeige zurück (Drittel 0, gestoppt) – die bereits protokollierten
Ereignisse bleiben unverändert erhalten. Die Länge eines Drittels lässt
sich über "Min./Drittel" anpassen (z. B. für den Nachwuchs mit
kürzeren Spielzeiten).

Die Uhr überlebt einen Seiten-Reload (der Zustand liegt auf dem
Server) und bleibt über mehrere Geräte/Tabs in Echtzeit synchron –
schaut z. B. der Co-Trainer parallel auf dem Handy zu, sieht er
Start/Pause/Drittel-Wechsel sofort mit. Bewusst kein automatischer
Stopp bei 0:00 – die Anzeige bleibt bei "00:00" stehen, der Coach
pausiert und wechselt manuell zum nächsten Drittel, sobald es real so
weit ist.

## Live-Spielstand

Direkt unter dem Spieltitel zeigt eine kleine Anzeige den aktuellen
Spielstand ("Wir 3 : 1 Gegnername") – automatisch berechnet aus den
bereits erfassten Tor-Ereignissen, kein eigenes Eingabefeld dafür
nötig. Ein Tor ohne Zuordnung oder mit einem eigenen Kader-Spieler
zählt als eigenes Tor, ein Tor mit "Gegner" als Zuordnung als
Gegentor. Löschst du ein fälschlich erfasstes Tor wieder, passt sich
der Stand sofort an.

## Spielbericht (PDF-Export)

Der Button "Spielbericht exportieren" direkt neben dem Spielstand
erzeugt eine druckfreundliche PDF-Zusammenfassung: Gegner/Datum,
Endstand, die Ereignis-Zeitleiste (nur die strukturierten Ereignisse,
nicht die Freitext-Notizen) und der Match-Kader-Status. Gedacht zum
Ausdrucken oder Weitergeben an Verein/Eltern – kein Ersatz für die
Notizen-Ansicht auf dieser Seite.

Auf der Spielübersicht (`/games`) exportiert "Als CSV exportieren"
zusätzlich alle sichtbaren Spiele (Datum, Gegner, Team, Endstand) als
CSV-Datei – für die Weiterverarbeitung in Excel/Sheets, offenes Format
statt Bildschirm-Tabelle (siehe auch [Statistiken](./Statistiken.md)
für den CSV-Export der Saison-Kennzahlen je Spieler).

Ist auf dieser Instanz ein KI-Anbieter konfiguriert, erscheint
zusätzlich "KI-Spielanalyse" – siehe
[KI-Assistenten: Spiel-Insights](./KI-Assistenten.md#spiel-insights-im-detail).

## Match-Kader

Zusätzlich zur Anwesenheit (oben) zeigt jedes Spiel einen
"Match-Kader"-Bereich: pro [Kader-Spieler](./Kader.md) legt der
Trainer fest, ob er **spielt**, **Ersatz** ist, **verletzt** ist oder
**fehlt** – unabhängig davon, ob dieser Spieler überhaupt einen
eigenen Account hat (anders als RSVP, das nur für Team-Mitglieder mit
Login funktioniert). Ein Klick auf ⟲ setzt den Status zurück auf
"nicht entschieden". Match-Kader ist bewusst getrennt von
[Lines](./Lines.md): eine Line ist eine spielübergreifende taktische
Vorlage, der Match-Kader gilt nur für dieses eine Spiel und verändert
keine Line.

## Line-Statistiken

Jeder Line-Wechsel während eines Spiels (siehe [Lines](./Lines.md#aktive-line))
legt zusätzlich zur weiterhin unveränderten Freitext-Notiz eine
strukturierte, zeitgestempelte Aufzeichnung an: welche Line wann
"auf dem Feld" war. Direkt unter den Line-Buttons zeigt eine
"Line-Statistiken"-Sektion je Line: die Zeit zusammen (mm:ss, ein "+"
bedeutet die Line ist gerade aktiv und die Zahl läuft live weiter)
sowie das Torverhältnis (eigene : gegnerische Tore), während diese
Line auf dem Feld war. Steht "unbekannt" bei der Zeit, gibt es noch
keine abgeschlossene Phase dieser Line in diesem Spiel. Rein
informativ – ändert nichts an der Taktik-Vorlage selbst.

## Schuss-Tracking

Zusätzlich zum einfachen "Tor"-Preset (weiterhin unverändert die
schnellste Option) gibt es den Button "Schuss erfassen" für eine
detailliertere Aufzeichnung: Zuordnung (Kader-Spieler, Gegner oder
ohne Angabe – bei einem Gegner-Schuss zusätzlich optional "unser
Torhüter"), Position auf einem einfachen, floorball-eigenen
Zonen-Diagramm (Nahzone Zentrum/Links/Rechts, Halbdistanz, Distanz –
bewusst kein Eishockey-Feld), Schusstyp (Handgelenkschuss,
Schlagschuss, Direktschuss, Rückhand) und Ergebnis (Tor, Gehalten,
Verfehlt, Geblockt).

Ein Schuss mit Ergebnis "Tor" aktualisiert automatisch den
Live-Spielstand – kein zusätzlicher, separater Eintrag nötig. In der
Zeitleiste erscheint dafür eine einzige Zeile ("Schuss (Tor) – ...").

Bei eigenem Tor (nicht bei einem Gegner-Schuss) erscheint zusätzlich
eine Vorlagen-Auswahl (Assist) aus dem Kader dieses Spiels – der
Torschütze selbst steht dort nicht zur Auswahl. Vorlagen fließen in
die [Statistiken](./Statistiken.md) (Vorlagen/Punkte je Spieler) ein.
Bewusst nur hier, nicht beim schnellen "Tor"-Preset oben – dieser
bleibt der schnellste, detailfreie Weg fürs Live-Erfassen.

Direkt darunter zeigen zwei weitere Sektionen:

- **Schuss-Statistiken**: Anzahl Schüsse, Schüsse aufs Tor, Tore,
  Schuss-%, Aufschlüsselung nach Zone, sowie eine Shot Map (dieselbe
  Zonen-Grafik, jetzt mit einem Punkt je Schuss – gefüllter Kreis =
  Tor, Ring = gehalten, Kreuz = verfehlt, Quadrat = geblockt).
- **Torhüter-Statistiken**: erscheint nur, wenn mindestens ein
  Gegner-Schuss einem Torhüter zugeordnet wurde – zeigt Schüsse aufs
  Tor, Paraden, Gegentore und Fangquote je Torhüter.

## Spielvideos und Video-Verknüpfung

Unter dem Statistik-Bereich lässt sich bis zu 5 Videos pro Spiel
hochladen (Format/Größen-Grenzen wie bei
[Board-Videos](./Video-Integration.md), aber eine eigene, spielbezogene
Video-Ablage statt an ein Board gehängt) – z. B. die Aufnahme der ersten
und zweiten Halbzeit als zwei separate Clips. Zeichnen-Überlagerung,
Trimmen und Szenen-Marken funktionieren identisch zu Board-Videos.

Zusätzlich lässt sich direkt am Video die aktuelle Wiedergabeposition
mit einem bereits erfassten Ereignis aus der Zeitleiste verknüpfen:
Video an die passende Stelle spulen, Ereignis aus der Liste auswählen,
"Aktuelle Position verknüpfen". Das funktioniert **nachträglich beim
Sichten nach dem Spiel** genauso wie **live**, während ein zweites
Gerät bereits mitfilmt – die Verknüpfung ist der einzige Fall, in dem
sich ein bereits erfasstes Ereignis noch ändern lässt (nur der
Video-Link, nicht Ereignistyp/Zuordnung/Ergebnis – siehe ADR-0005 in
`docs/planning/DECISIONS.md`). Ein verknüpftes Ereignis zeigt in der
Zeitleiste ein Video-Symbol; ein Klick darauf springt direkt zur
verknüpften Stelle im Video.

## Technischer Hinweis

Die 10 festen Ereignis-Buttons (Anstoß Drittel 1–3, Drittelende,
Auszeit, Tor, Strafe 2/5 Min., Matchstrafe, Spielende) werden seit
dem Roadmap-Punkt "Live-Match-Ereignisse" **strukturiert** gespeichert
(Ereignistyp + Zuordnung als eigene Datenbank-Felder statt fertigem
Text) – das ist die Grundlage für spätere Statistiken (Tore je
Spieler, Strafminuten, Stand je Drittel). Line-Wechsel werden
zusätzlich in einer eigenen `match_lines`-Tabelle festgehalten (Basis
für die Line-Statistiken oben). Ein per "Schuss erfassen" erfasstes
Tor legt intern zwei verknüpfte Datensätze an (den detaillierten
Schuss + ein schlankes Tor-Ereignis für den Spielstand) – für den
Trainer unsichtbar, in der Zeitleiste erscheint dafür nur eine Zeile.
Das freie Eingabefeld und die Notiz
beim Line-Wechsel bleiben unverändert Freitext und nutzen weiterhin
dieselbe Kommentar-Infrastruktur wie Boards und Trainingseinheiten.
Beide Quellen erscheinen gemeinsam in einer Liste, sortiert nach
Zeitpunkt – für den Trainer ändert sich an der Bedienung nichts.

Bereits vor diesem Umbau erfasste Ereignisse bleiben als eingefrorener
Text sichtbar (keine rückwirkende Umwandlung).

## Verwandt

- [Trainingsplaner](./Trainingsplaner.md)
- [Video-Integration](./Video-Integration.md) – Zeichnen/Trimmen/Marken,
  identisch für Board- und Spielvideos
