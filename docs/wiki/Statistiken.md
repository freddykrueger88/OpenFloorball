# 📊 Statistiken

Unter `/stats` zeigt eine Tabelle für jeden [Kader-Spieler](./Kader.md)
Tore, Strafminuten, Matchstrafen, Einsätze, Schüsse/Schuss-% sowie
(nur für Torhüter) Gegentore/Fangquote – aggregiert über alle seine
Spiele hinweg, sortiert nach Toren.

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

## Umfang (bewusst einfach gehalten)

Noch **keine Vorlagen/Assists** (bräuchten eine zweite Spieler-
Zuordnung beim Tor-Erfassen – das dafür vorgesehene Datenfeld
existiert bereits, wird aber noch nicht über eine UI befüllt) und
**kein Stand je Drittel**. Beides sind eigene, spätere
Erweiterungsschritte.

## Verwandt

- [Live-Spielnotizen](./Live-Spielnotizen.md)
- [Kader](./Kader.md)
