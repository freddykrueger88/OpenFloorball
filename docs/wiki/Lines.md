# 🥍 Lines (Sturm-/Defensivreihen)

Im Floorball gibt es laufende, unbegrenzte Spielerwechsel – eine Line
ist deshalb keine feste Gruppe, die dauerhaft zusammengehört, sondern
eine **vorbereitete Kombination von Kader-Spielern**, mit der ein
Trainer während des Spiels schnell zwischen verschiedenen
Aufstellungen wechseln kann. Ein Spieler kann in beliebig vielen
Lines vorkommen (z. B. ein Center, der sowohl in der 1. als auch in
der 2. Sturmreihe spielt).

> ⚠️ Frühere Version: Lines gruppierten bis vor Kurzem nur anonyme
> Platzhalter-Positionen *eines bestimmten* Board-Diagramms zur
> farblichen Hervorhebung, ohne Bezug zum echten Kader. Das war
> fachlich nicht richtig – Lines sind jetzt vollständig auf den
> [Kader](./Kader.md) umgestellt, siehe CHANGELOG.

## Line anlegen

Unter `/lines`:

- **Name** (frei wählbar)
- **Typ**: Sturm (offense), Verteidigung (defense), Special Teams
  (special)
- **Farbe**: zur visuellen Unterscheidung
- optional mit einem **Team teilen** (wie bei
  [Kader](./Kader.md)/[Spielen](./Live-Spielnotizen.md) – lesen
  dürfen dann alle Team-Mitglieder, ändern nur Owner/Co-Trainer)

Maximal **20 Lines** pro Account.

## Spieler zuweisen

Über "Spieler hinzufügen" eine Line mit Kader-Spielern derselben
Sichtbarkeits-Gruppe (Team-Kader bei team-geteilten Lines, sonst der
persönliche Kader) befüllen. Ein Spieler kann **gleichzeitig in
mehreren Lines stehen** – das Hinzufügen zu einer zweiten Line
entfernt ihn nicht aus der ersten. Entfernen aus einer Line betrifft
ebenfalls nur diese eine Line.

## Aktive Line

Nur eine Line kann gleichzeitig "aktiv" sein (bei team-geteilten
Lines: eine je Team, bei persönlichen Lines: eine je Account).
Aktivieren einer anderen Line deaktiviert automatisch die vorherige.

**Schneller Wechsel während des Spiels**: auf der
[Spielseite](./Live-Spielnotizen.md) (`/games/:id`) erscheinen die
Lines direkt über den Live-Notizen – ein Klick aktiviert die Line und
trägt automatisch eine Notiz mit Zeitstempel ein (z. B. "Linienwechsel
– Line 2"), ohne dass extra auf `/lines` gewechselt werden muss.
Zusätzlich entsteht dabei ein strukturierter Datensatz, aus dem die
[Line-Statistiken](./Live-Spielnotizen.md#line-statistiken) (Zeit
zusammen, Torverhältnis je Line) berechnet werden – die Taktik-Vorlage
selbst (`is_active` oben) bleibt davon unberührt.

## Im Board-Editor

Im Board-Editor gibt es zwischen "Zeichnen" und "Formationen" ebenfalls
einen "Lines"-Tab – dort lassen sich die eigenen Lines mit einem Klick
**anwenden**: die Namen/Nummern der Line-Spieler werden nach Rolle
(TW/V/C/S) auf die Heimteam-Positionen des aktuellen Frames übertragen,
ohne Positionen zu verändern. Nur Rollen, die die Line auch enthält,
werden angepasst – andere Positionen bleiben unverändert. Anlegen,
Umbenennen und Spieler zuweisen bleibt bewusst auf `/lines`
("Lines verwalten"-Link im Tab).

## Verwaltung

- Lines umbenennen (Doppelklick auf den Namen), Löschen (Spieler
  selbst bleiben im Kader erhalten, nur die Zuordnung verschwindet)
- Löschen eines Kader-Spielers entfernt automatisch seine Zuordnung
  in allen Lines, in denen er stand – die Lines selbst bleiben

## Verwandt

- [Kader](./Kader.md) – Spieler zentral pflegen, Grundlage für Lines
- [Live-Spielnotizen](./Live-Spielnotizen.md) – schneller Line-Wechsel
  während eines laufenden Spiels
- [Formationen](./Formationen.md) – ganze Startaufstellungen
  (Positionen auf dem Feld) als Vorlage speichern, anderes Konzept als
  Lines (Formationen sind Positionen, Lines sind Spieler-Kombinationen)
