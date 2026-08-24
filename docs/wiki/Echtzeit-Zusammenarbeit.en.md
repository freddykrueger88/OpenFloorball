# 🟢 Real-Time Collaboration (Presence)

*[🇩🇪 Deutsch](Echtzeit-Zusammenarbeit.md) | 🇬🇧 English*

Shows who's currently viewing the same board in the board editor, and
broadcasts other users' live cursor positions.

## What it does

- **Presence badges**: names/initials of everyone who currently has
  the board open.
- **Live cursor**: other users' mouse positions are shown as a
  colored dot with their name on the field (throttled so it doesn't
  overload the connection).

## What it deliberately does NOT do

- **No server-side conflict resolution or live merging** of
  drawings/player positions. Saving still goes through the normal
  autosave path (see [Offline mode](./Offline-Modus.en.md)) – presence
  is a pure display feature, not a sync mechanism.
- **No persistence**: cursor positions aren't stored in the database,
  only relayed live.

## Technical background

A dedicated WebSocket server (not part of the REST API under `/api`),
one "room" per board. Authenticated via the same HttpOnly session
cookie as the REST API – no separate credentials needed.

## Related pages

- [Architecture](./Architektur.en.md)
- [Drawing plays](./Spielzuege-Zeichnen.en.md)
