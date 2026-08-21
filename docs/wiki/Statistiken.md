# 📊 Statistiken

Unter `/stats` zeigt eine Tabelle für jeden [Kader-Spieler](./Kader.md)
Tore, Strafminuten, Matchstrafen, Einsätze, Schüsse/Schuss-% sowie
(nur für Torhüter) Gegentore/Fangquote – aggregiert über alle seine
Spiele hinweg, sortiert nach Toren. Auf der Spielseite selbst zeigen
zwei weitere Panels, wie sich ein Spiel im Detail entwickelt hat:
Special Teams (Powerplay/Penalty Kill) und Situations-Splits (Führung/
Rückstand/Unentschieden, je Periode).

## Woher die Zahlen kommen

Rein abgeleitet aus bereits vorhandenen Daten, keine zusätzliche
Eingabe nötig:

- **Tore**: Anzahl der [Live-Match-Ereignisse](./Live-Spielnotizen.md)
  vom Typ "Tor", die diesem Spieler zugeordnet wurden. Ein Tor ohne
  Zuordnung zählt zwar für den [Live-Spielstand](./Live-Spielnotizen.md#live-spielstand)
  des Teams, aber – naheliegend – für keinen einzelnen Spieler.
- **Strafminuten**: 2-Minuten- und 5-Minuten-Strafen, aufsummiert.
- **Matchstrafen**: Anzahl separat gezählt (keine feste Minutenzahl,
  da eine Matchstrafe in der Realität das restliche Spiel betrifft).
- **Einsätze**: Anzahl Spiele, in denen der [Match-Kader](./Live-Spielnotizen.md#match-kader)-Status
  auf "spielt" gesetzt war.
- **Schüsse/Schuss-%**: aus per [Schuss-Tracking](./Live-Spielnotizen.md#schuss-tracking)
  erfassten eigenen Schüssen. Schuss-% bezieht sich nur auf Schüsse
  aufs Tor (Tor+Gehalten), nicht auf verfehlte/geblockte Schüsse.
- **Gegentore/Fangquote**: nur für Spieler mit Kader-Rolle "TW"
  sichtbar, aus Gegner-Schüssen, die diesem Torhüter zugeordnet
  wurden. Ohne Schüsse aufs Tor steht "–" statt einer irreführenden
  0%-Fangquote.
- **Trainings-%**: Beteiligungsquote aus der [tatsächlichen
  Trainings-Anwesenheit](./Trainingsplaner.md#tatsächliche-anwesenheit)
  (erfasste Trainings, bei denen der Spieler "Anwesend" war, geteilt
  durch alle erfassten Trainings – RSVP-Zusagen zählen hier nicht mit).
  Ohne ein einziges erfasstes Training steht "–" statt einer
  irreführenden 0%.

## Special Teams (Powerplay/Penalty Kill)

Auf der Spielseite zeigt das Panel "Special teams", wie erfolgreich
das Team bei eigenem Zahlenvorteil (Powerplay) und in eigener
Unterzahl (Penalty Kill) war – abgeleitet aus den erfassten Strafen
(2/5 Minuten) und der Spieluhr, keine zusätzliche Eingabe nötig.

- **Powerplay-%**: Tore bei eigenem Zahlenvorteil geteilt durch die
  Anzahl der Gelegenheiten.
- **Penalty-Kill-%**: Anteil der eigenen Unterzahl-Situationen, in
  denen kein Gegentor fiel.

Bewusst vereinfacht (siehe ADR-0004 in
[`docs/planning/DECISIONS.md`](../planning/DECISIONS.md)): eine Strafe
endet spätestens mit dem Periodenende (kein Übertrag über die
Drittelpause hinaus), eine Matchstrafe erzeugt keinen eigenen
Zahlenvorteil-Zeitraum (keine verlässliche Dauer bekannt), und jede
Strafe zählt als eigene Gelegenheit statt mehrere sich überlappende
Strafen zu einer einzigen zusammenzufassen. Ohne Gelegenheiten in
diesem Spiel steht "–" statt einer irreführenden 0%.

## Situations-Splits

Das Panel "Situational splits" schlüsselt Tore (und, sofern
[Schuss-Tracking](./Live-Spielnotizen.md#schuss-tracking) genutzt
wurde, auch Schüsse/Schuss-%) danach auf,

- **wie der Spielstand unmittelbar vor dem jeweiligen Ereignis war**
  (in Führung / im Rückstand / unentschieden), und
- **in welcher Periode** das Ereignis stattfand.

Beide Aufschlüsselungen laufen automatisch mit, sobald Tore bzw.
Schüsse erfasst werden – keine zusätzliche Eingabe.

## Spieler-Vergleich

Auf `/stats` lassen sich per Checkbox bis zu 4 Kader-Spieler
auswählen; darunter erscheint automatisch eine Vergleichstabelle mit
denselben Kennzahlen wie in der Haupttabelle, nur Spieler statt Zeilen
nebeneinandergestellt. Nutzt dieselben bereits geladenen
Saison-Zahlen – keine zusätzliche Abfrage.

## Trends

Ein Klick auf das Trend-Symbol neben einem Spieler auf `/stats` öffnet
dessen Verlaufsseite (`/stats/:id`): Tore, Tore/Spiel, Schüsse/Schuss-%
und Strafminuten jeweils für die letzten 5 Spiele, die letzten 10
Spiele und die gesamte Saison im Vergleich, plus eine Übersicht der
Tore je Spiel als einfache Balkenliste. Prozentwerte werden dabei
NICHT aus einzelnen Spiel-Prozentwerten gemittelt, sondern aus den
aufsummierten Rohzahlen des jeweiligen Zeitfensters neu berechnet –
sonst würde ein Fenster mit wenigen Schüssen genauso stark gewichtet
wie eines mit vielen.

Auf derselben Verlaufsseite (`/stats/:id`) erscheint zusätzlich eine
**Trainings-Beteiligung**-Tabelle im gleichen Last-5/Last-10/Saison-
Muster (erfasste Trainings, Beteiligungsquote) sowie – nur für
coach/owner sichtbar – die **Spielerentwicklung**: freie,
zeitgestempelte Beobachtungsnotizen zu diesem Spieler. Jeder Coach
kann eigene Notizen hinzufügen und bearbeiten; der Team-Owner kann
zusätzlich fremde Notizen löschen (Moderation). Diese Notizen sind
personenbezogene Daten über den Spieler (oft minderjährig) – sie
erscheinen deshalb nirgends für Team-Mitglieder ohne Coach-Rolle,
anders als z. B. Kommentare auf Boards/Trainingseinheiten.

## Umfang (bewusst einfach gehalten)

Noch **keine Vorlagen/Assists** (bräuchten eine zweite Spieler-
Zuordnung beim Tor-Erfassen – das dafür vorgesehene Datenfeld
existiert bereits, wird aber noch nicht über eine UI befüllt) und
**kein Stand je Drittel**. Beides sind eigene, spätere
Erweiterungsschritte.

## Verwandt

- [Live-Spielnotizen](./Live-Spielnotizen.md)
- [Kader](./Kader.md)
