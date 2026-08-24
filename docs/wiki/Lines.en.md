# 🥍 Lines (offense/defense lines)

*[🇩🇪 Deutsch](Lines.md) | 🇬🇧 English*

Floorball has continuous, unlimited player changes – so a line isn't a
fixed group that permanently belongs together, but a **prepared
combination of roster players** that a coach can quickly switch
between during a game. A player can appear in any number of lines
(e.g. a center who plays in both the 1st and 2nd forward line).

> ⚠️ Earlier version: until recently, lines only grouped anonymous
> placeholder positions *of one specific* board diagram for color
> highlighting, with no connection to the actual roster. That wasn't
> conceptually correct – lines are now fully based on the
> [roster](./Kader.en.md), see CHANGELOG.

## Creating a line

Under `/lines`:

- **Name** (freely chosen)
- **Type**: offense, defense, special teams (special)
- **Color**: for visual distinction
- optionally **share with a team** (like
  [roster](./Kader.en.md)/[games](./Live-Spielnotizen.en.md) – all
  team members can then read it, only owner/assistant coaches can
  change it)

Maximum of **20 lines** per account.

## Assigning players

Use "Add player" to fill a line with roster players from the same
visibility group (team roster for team-shared lines, otherwise your
personal roster). A player can be **in multiple lines at the same
time** – adding them to a second line doesn't remove them from the
first. Removing from a line likewise only affects that one line.

## Active line

Only one line can be "active" at a time (for team-shared lines: one
per team, for personal lines: one per account). Activating another
line automatically deactivates the previous one.

**Quick switching during a game**: on the
[game page](./Live-Spielnotizen.en.md) (`/games/:id`), lines appear
directly above the live notes – one click activates the line and
automatically logs a timestamped note (e.g. "Line change – Line 2"),
without having to switch to `/lines` separately. This also creates a
structured record from which [line statistics](./Live-Spielnotizen.en.md#line-statistics)
(time together, goal ratio per line) are calculated – the tactical
template itself (`is_active` above) is unaffected by this.

## Line chemistry (season)

Directly on `/lines`, the "Line chemistry (season)" section shows the
same metrics as the [line statistics](./Live-Spielnotizen.en.md#line-statistics)
on the game page, but **aggregated across all games** – so you can see
which line performed best over the whole season, not just in a single
game. Sorted by goal difference. A currently ongoing (not yet
concluded by a line change) time-on-field phase in a game in progress
is deliberately not included – it only counts after the next line
change, so the season number doesn't depend on when you happen to look
at it.

## In the board editor

The board editor also has a "Lines" tab between "Draw" and
"Formations" – there you can **apply** your own lines with one click:
the line players' names/numbers are transferred by role (GK/D/C/A) to
the home team positions of the current frame, without changing
positions. Only roles that the line actually contains are adjusted –
other positions stay unchanged. Creating, renaming, and assigning
players deliberately stays on `/lines` ("Manage lines" link in the
tab).

## Management

- Rename lines (double-click the name), delete (players themselves
  stay in the roster, only the assignment disappears)
- Deleting a roster player automatically removes their assignment from
  every line they were part of – the lines themselves remain

## Related

- [Roster](./Kader.en.md) – maintain players centrally, the foundation
  for lines
- [Live game notes](./Live-Spielnotizen.en.md) – quick line switching
  during a game in progress
- [Formations](./Formationen.en.md) – save whole starting lineups
  (positions on the field) as templates, a different concept from
  lines (formations are positions, lines are player combinations)
