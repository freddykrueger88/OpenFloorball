# 🏠 Player Dashboard

*[🇩🇪 Deutsch](Spieler-Dashboard.md) | 🇬🇧 English*

A new landing page at `/dashboard` (in addition to `/boards`, not a
replacement) – meant as the go-to place for match day, everyday training,
and a personal season overview.

## What does the dashboard show?

- **Next game**: countdown, opponent, kickoff time, venue/address, home/
  away, status (scheduled/postponed/cancelled) – plus direct RSVP.
- **Next training**: the same core info, more compact, also with direct
  RSVP.
- **My stats**: goals/assists/points/penalty minutes, or for goalkeepers
  goals against/save percentage, plus the last 5 games as a small bar
  chart.
- **Last game**: final score and your own performance in it.
- **Season overview**: games/wins/draws/losses/goal difference.
- **Upcoming events**: the next 5 games/trainings mixed, chronologically.
- **Quick links** and an **OpenStreetMap map** for the next venue (address
  fallback when no coordinates are on file).

## Direct RSVP

Reuses the existing [RSVP system](./Live-Spielnotizen.en.md#attendance-rsvp)
as-is (status `yes`/`no`/`maybe`) – new is only a compact, **optimistic**
widget right inside the dashboard card: a click saves immediately and
visibly, a failure automatically rolls back to the previous status. Locked
for cancelled or already past events.

## Why did this need new database columns?

Two real gaps had to be closed so the dashboard wouldn't just show sample
data:

1. **Game/training logistics.** `games`/`training_sessions` previously
   only had a date, no time, no venue, no status. Added additively:
   `kickoff_time`/`start_time`, `venue_name`/`venue_address`/`venue_lat`/
   `venue_lng`, `is_home` (games only), `status`
   (`scheduled`/`postponed`/`cancelled`), `duration_minutes` (training
   sessions only). All fields nullable – existing entries get a clean
   fallback instead of a fabricated value.
2. **Linking a login account to a roster entry.** `roster_players.user_id`
   is the creator/coach, not necessarily the player themselves – without an
   additional link, no account could ever determine which roster entry is
   "them", and therefore never see their own goals/assists. New:
   `roster_players.linked_user_id` (nullable, an account can be linked to
   at most one roster entry). Settable by the team owner/coach directly on
   [`/roster`](./Kader.en.md), only for team-shared entries and only with
   actual team members as the target.

## Optional Saisonmanager connection

[Floorball Deutschland's Saisonmanager](https://saisonmanager.de) already
manages schedules and tables for many clubs. A team can connect to it
(Settings → Teams → Saisonmanager, owner-only): enter an API key, league
ID, and your own Saisonmanager team ID. The dashboard then shows real
kickoff times/venues/league positions instead of your own, manually
maintained values.

- **Fully optional and read-only.** Without a connection, nothing changes
  – your own `games` remain the source. There is no write-back to
  Saisonmanager.
- **The API key never leaves the backend.** It's only used server-side
  (`X-Api-Key` header against `saisonmanager.de/api/v2`), the same pattern
  already used for AI provider keys.
- A club must obtain the API key from Floorball Deutschland themselves –
  that's not part of this integration.

## Direct RSVP – special cases

Blocked both client-side (buttons disabled) and server-side
(`rsvpsController.js::guardEditable`): responding to a cancelled or
already past event (date + time; without a recorded time, the whole
calendar day counts) is rejected with a 400.

## Known limitations

- No RSVP deadline – this concept doesn't exist in the data model and
  isn't faked.
- Without a Saisonmanager connection there's no league position/points –
  only what's honestly derivable from your own games (no invented table).
- `/` still redirects to `/boards`, not `/dashboard` – switching the
  default landing page is a separate, future step.

## Related pages

- [Live game notes](./Live-Spielnotizen.en.md) (RSVP system, live events)
- [Roster](./Kader.en.md) (login account linking)
- [Teams and clubs](./Teams-und-Vereine.en.md) (Saisonmanager connection)
- [Training planner](./Trainingsplaner.en.md)
