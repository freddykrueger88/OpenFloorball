# ⭐ Formationen-Vorlagen

*🇩🇪 Deutsch | [🇬🇧 English](Formationen.en.md)*

Eine Formation speichert eine komplette Spieleraufstellung (Positionen
aller Spieler) als wiederverwendbare Vorlage – unabhängig von einem
bestimmten Board.

## Speichern

Im unteren Tab-Menü unter "Formationen": aktuelle Aufstellung des
gerade offenen Boards unter einem Namen speichern. Die Vorlage ist an
den **Spielfeld-Typ** gebunden, mit dem sie gespeichert wurde
(Großfeld/Kleinfeld/Street/3vs3).

Maximal **20 Formations-Vorlagen** pro Account.

## Laden

Eine gespeicherte Formation in ein beliebiges Board laden:

- Gleicher Spielfeld-Typ → Positionen werden 1:1 übernommen
- Anderer Spielfeld-Typ → Positionen werden proportional auf die neue
  Feldgröße skaliert

Das Laden überschreibt die aktuellen Spielerpositionen im aktiven
Frame (nicht rückgängig zu machen außer über `Strg+Z`, solange man den
Frame nicht verlässt).

## Unterschied zu Lines und Playbooks

| Konzept | Was es speichert |
|---|---|
| **Formation** | Eine komplette Startaufstellung (Positionen) |
| [**Line**](./Lines.md) | Eine taktische Kombination echter Kader-Spieler (z. B. eine Sturmreihe), nicht board-gebunden |
| [**Playbook**](./Playbooks.md) | Eine thematische Sammlung mehrerer Boards |
