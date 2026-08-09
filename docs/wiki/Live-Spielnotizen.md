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
   müssen.
4. Der "Tor"-Button öffnet zusätzlich eine Torschützen-Auswahl aus dem
   [Kader](./Kader.md) des Spiels (team-geteilte Spiele: Kader dieses
   Teams, sonst der persönliche Kader) – seit dem IFF-Regelwerk 2026
   dürfen auch Torhüter ein Tor erzielen, die Auswahl filtert Rollen
   deshalb bewusst nicht. Alternativ "Ohne Torschütze" wählen, wenn
   z. B. der Gegner trifft.
5. Notizen erscheinen neueste zuerst, jeweils mit Uhrzeit (und bei
   team-geteilten Spielen mit dem Namen der Autorin/des Autors).

## Zugriff und Löschen

Eine Notiz kann von der Autorin/dem Autor selbst gelöscht werden oder
von jedem mit Schreibzugriff auf das Spiel (Owner/Co-Trainer) –
dieselbe Regel wie bei [Kommentaren](./Export.md). Ein Bearbeiten von
Notizen ist bewusst nicht vorgesehen: bei einem Tippfehler einfach
löschen und neu erfassen.

## Technischer Hinweis

Notizen sind keine eigene Datenbanktabelle, sondern nutzen dieselbe
Kommentar-Infrastruktur wie Boards und Trainingseinheiten – die
Oberfläche ist aber bewusst eine eigene, auf Geschwindigkeit
ausgelegte Ansicht statt der allgemeinen Kommentar-Ansicht.

## Verwandt

- [Trainingsplaner](./Trainingsplaner.md)
- [Video-Integration](./Video-Integration.md) – Analyse im Nachhinein
  statt live
