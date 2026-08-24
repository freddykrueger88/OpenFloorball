# 📊 Statistics

*[🇩🇪 Deutsch](Statistiken.md) | 🇬🇧 English*

Under `/stats`, a table shows every [roster player](./Kader.en.md)'s
goals, assists, points, penalty minutes, match penalties, appearances,
shots/shot % and (goalkeepers only) goals against/save % – aggregated
across all their games, sorted by goals. "Export as CSV" downloads
exactly this table as a file – an open format instead of just an
on-screen view (data portability, CLAUDE.md §5.3). On the game page
itself, two further panels show how a game unfolded in detail: special
teams (power play/penalty kill) and situational splits (leading/
trailing/tied, per period).

## Where the numbers come from

Purely derived from data that already exists, no extra input needed:

- **Goals**: the count of [live game events](./Live-Spielnotizen.en.md)
  of type "Goal" attributed to this player. An unattributed goal still
  counts toward the team's [live score](./Live-Spielnotizen.en.md#live-score),
  but — naturally — toward no individual player.
- **Assists**: the count of goals where this player was recorded as
  the assist provider. Only enterable via
  [shot tracking](./Live-Spielnotizen.en.md#shot-tracking) (an
  additional assist picker appears there when the outcome is "Goal") –
  the quick "Goal" preset deliberately omits this extra picker so it
  doesn't slow down live entry.
- **Points**: goals + assists, computed at display time.
- **Penalty minutes**: 2-minute and 5-minute penalties, summed up.
- **Match penalties**: counted separately (no fixed minute value, since
  a match penalty affects the rest of the game in reality).
- **Appearances**: the number of games where the
  [match squad](./Live-Spielnotizen.en.md#match-squad) status was set
  to "Playing".
- **Shots/shot %**: from own shots recorded via
  [shot tracking](./Live-Spielnotizen.en.md#shot-tracking). Shot % only
  refers to shots on goal (goal + saved), not missed/blocked shots.
- **Goals against/save %**: only shown for players with the roster role
  "GK", from opponent shots attributed to this goalkeeper. Without any
  shots on goal, it shows "–" instead of a misleading 0% save rate.
- **Training %**: participation rate from [actual training
  attendance](./Trainingsplaner.en.md#actual-attendance) (recorded
  training sessions where the player was "Present", divided by all
  recorded training sessions – RSVP confirmations don't count here).
  Without a single recorded training session, it shows "–" instead of a
  misleading 0%.

## Special teams (power play/penalty kill)

On the game page, the "Special teams" panel shows how successful the
team was on its own power play and while shorthanded (penalty kill) –
derived from the recorded penalties (2/5 minutes) and the game clock,
no extra input needed.

- **Power play %**: goals scored while on the power play divided by the
  number of opportunities.
- **Penalty kill %**: the share of the team's own shorthanded
  situations in which no goal was conceded.

Deliberately simplified (see ADR-0004 in
[`docs/planning/DECISIONS.md`](../planning/DECISIONS.md)): a penalty
ends at the latest at the end of the period (no carryover past the
intermission), a match penalty doesn't create its own power-play window
(no reliable duration is known), and every penalty counts as its own
opportunity instead of merging several overlapping penalties into one.
Without any opportunities in a given game, it shows "–" instead of a
misleading 0%.

## Situational splits

The "Situational splits" panel breaks down goals (and, if [shot
tracking](./Live-Spielnotizen.en.md#shot-tracking) was used, also
shots/shot %) by

- **the score state immediately before the event** (leading / trailing
  / tied), and
- **which period** the event happened in.

Both breakdowns run automatically as soon as goals or shots are
recorded – no extra input.

## Player comparison

On `/stats`, up to 4 roster players can be selected via checkbox; a
comparison table then appears automatically with the same metrics as
the main table, just with players instead of rows side by side. Uses
the same already-loaded season numbers – no extra query.

## Trends

Clicking the trend icon next to a player on `/stats` opens their
history page (`/stats/:id`): goals, assists, points, goals/game,
shots/shot %, and penalty minutes for the last 5 games, the last 10
games, and the whole season, side by side, plus an overview of goals
per game as a simple bar list. Percentages are NOT averaged from
individual per-game percentages, but recomputed from the summed raw
numbers of the respective time window – otherwise a window with few
shots would be weighted the same as one with many.

The same history page (`/stats/:id`) also shows a **training
participation** table in the same last-5/last-10/season pattern
(recorded training sessions, participation rate) as well as – visible
only to coach/owner – **player development**: free-form, timestamped
observation notes about this player. Every coach can add and edit their
own notes; the team owner can additionally delete other coaches' notes
(moderation). These notes are personal data about the player (often a
minor) – they therefore never appear to team members without a coach
role, unlike, say, comments on boards/training sessions.

## Scope (deliberately kept simple)

No **per-period breakdown** yet – a separate, later expansion step.

## Related

- [Live game notes](./Live-Spielnotizen.en.md)
- [Roster](./Kader.en.md)
