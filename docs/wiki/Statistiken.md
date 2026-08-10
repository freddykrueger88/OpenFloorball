# 📊 Statistiken

Unter `/stats` zeigt eine Tabelle für jeden [Kader-Spieler](./Kader.md)
Tore, Strafminuten, Matchstrafen und Einsätze – aggregiert über alle
seine Spiele hinweg, sortiert nach Toren.

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

## Umfang (bewusst einfach gehalten)

Noch **keine Vorlagen/Assists** (bräuchten eine zweite Spieler-
Zuordnung beim Tor-Erfassen) und **kein Stand je Drittel** (bräuchte
ein zusätzliches Datenfeld an den Ereignissen). Beides sind eigene,
spätere Erweiterungsschritte.

## Verwandt

- [Live-Spielnotizen](./Live-Spielnotizen.md)
- [Kader](./Kader.md)
