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

## Technischer Hinweis

Die 10 festen Ereignis-Buttons (Anstoß Drittel 1–3, Drittelende,
Auszeit, Tor, Strafe 2/5 Min., Matchstrafe, Spielende) werden seit
dem Roadmap-Punkt "Live-Match-Ereignisse" **strukturiert** gespeichert
(Ereignistyp + Zuordnung als eigene Datenbank-Felder statt fertigem
Text) – das ist die Grundlage für spätere Statistiken (Tore je
Spieler, Strafminuten, Stand je Drittel). Das freie Eingabefeld und
die Notiz beim Line-Wechsel bleiben unverändert Freitext und nutzen
weiterhin dieselbe Kommentar-Infrastruktur wie Boards und
Trainingseinheiten. Beide Quellen erscheinen gemeinsam in einer
Liste, sortiert nach Zeitpunkt – für den Trainer ändert sich an der
Bedienung nichts.

Bereits vor diesem Umbau erfasste Ereignisse bleiben als eingefrorener
Text sichtbar (keine rückwirkende Umwandlung).

## Verwandt

- [Trainingsplaner](./Trainingsplaner.md)
- [Video-Integration](./Video-Integration.md) – Analyse im Nachhinein
  statt live
