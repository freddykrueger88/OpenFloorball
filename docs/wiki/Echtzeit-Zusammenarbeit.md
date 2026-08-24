# 🟢 Echtzeit-Zusammenarbeit (Presence)

*🇩🇪 Deutsch | [🇬🇧 English](Echtzeit-Zusammenarbeit.en.md)*

Zeigt im Board-Editor an, wer gerade dasselbe Board ansieht, und
überträgt Live-Cursor-Positionen anderer Nutzer.

## Was es macht

- **Präsenz-Badges**: Namen/Kürzel aller Personen, die das Board
  aktuell offen haben.
- **Live-Cursor**: die Mausposition anderer Nutzer wird als farbiger
  Punkt mit Namen auf dem Spielfeld eingeblendet (gedrosselt, um die
  Verbindung nicht zu überlasten).

## Was es bewusst NICHT macht

- **Keine serverseitige Konfliktauflösung oder Live-Merge** von
  Zeichnungen/Spielerpositionen. Speichern läuft weiterhin über den
  normalen Autosave-Pfad (siehe [Offline-Modus](./Offline-Modus.md))
  – Presence ist eine reine Anzeige, kein Sync-Mechanismus.
- **Keine Persistenz**: Cursor-Positionen werden nicht in der
  Datenbank gespeichert, nur live weitergeleitet.

## Technischer Hintergrund

Eigener WebSocket-Server (nicht Teil der REST-API unter `/api`), pro
Board ein "Raum". Authentifizierung über denselben HttpOnly-Session-
Cookie wie die REST-API – keine separaten Zugangsdaten nötig.

## Verwandte Seiten

- [Architektur](./Architektur.md)
- [Spielzüge zeichnen](./Spielzuege-Zeichnen.md)
