# 🏒 Live Game Notes

*[🇩🇪 Deutsch](Live-Spielnotizen.md) | 🇬🇧 English*

Create a game (opponent + date, optionally team-shared) and capture
quick, automatically timestamped notes while the game is in progress –
from your phone, e.g. on the bench. Unlike
[video markers](./Video-Integration.en.md), this doesn't require an
uploaded video: notes are created in the moment things happen, not
only during post-game review.

## Creating a game and capturing notes

Under `/games`:

1. Create a new game with opponent and date (both optional), optionally
   sharing it with a team (like the
   [training planner](./Trainingsplaner.en.md) – all team members can
   then read it, only owner/assistant coaches can change it).
2. On the game page, type notes into the large input field and confirm
   with "Add" – deliberately a single text field instead of a form, for
   quick use while standing.
3. For the regulated game interruptions per IFF rules (3 periods of 20
   min., one timeout per team, 2/5-minute penalties, match penalty),
   preset buttons appear above the input field – a tap logs the note
   directly with a timestamp, no typing needed. The buttons are sorted
   alphabetically (language-dependent, so the order differs between
   German/English).
4. "Goal", "2/5-minute penalty", and "Match penalty" additionally open
   an attribution picker from the [roster](./Kader.en.md) for this game
   (team-shared games: that team's roster, otherwise your personal
   roster) – each of these events always involves a person, whether on
   your own team or the opponent's. Alongside the roster, "Opponent" is
   therefore always selectable too, plus "No details" for when the
   person is unclear. Since the IFF rules 2026, goalkeepers may also
   score a goal, so the selection deliberately doesn't filter by role.
5. Notes appear newest first, each with a timestamp (and, for
   team-shared games, the name of the author).

## Access and deletion

A note can be deleted by its author or by anyone with write access to
the game (owner/assistant coach) – the same rule as for
[comments](./Export.en.md). Editing notes is deliberately not
supported: if there's a typo, just delete it and re-enter it.

## Custom event types

Alongside the fixed IFF presets, you can create your own event type
under the preset buttons ("Add custom type") – e.g. "Counterattack" or
"Turnover moment", to mark tactically interesting moments on the
timeline (and, since [video linking](#game-videos-and-video-linking),
also connect them directly to a video position). Just a label and
optionally "Needs attribution" (which then opens the roster/opponent
picker like the goal preset) – no icon, no color, no second
shot-tracking form, deliberately a simple, quick tag.

A custom type automatically belongs to this game: for a team-shared
game, to all team members (creation limited to owner/assistant
coaches), for a personal game, only to you – it then only appears for
games of the same team or your own personal games, not everywhere.
Deletion is possible at any time as long as the type hasn't been used
in any game yet; after that, an attempted deletion automatically
deactivates it instead of removing it (already-logged events stay
valid and readable as a result).

## Attendance (RSVP)

For a team-shared game, an "Attendance" section appears above the
notes: every team member sees the full team list and can respond for
themselves with yes/no/maybe – even without write access to the game
(self-reporting doesn't require edit permission). For a "no", you can
optionally give a reason (quick pick: sick, injured, work, vacation,
school, private, or free text). Without a team assignment (personal
game), there's no audience to report to, so the section doesn't
appear. Works identically for [training sessions](./Trainingsplaner.en.md).

## Game clock

Right below the score, a real game clock runs: "Start" begins period 1
(and automatically logs a kickoff entry in the event timeline, exactly
like a manual tap on the kickoff button), "Pause" stops it, "Next
period" automatically logs a period-end entry for the period that just
ended and resets the clock for the next one. Resuming after a pause
does **not** create a second kickoff entry. "Reset" only resets the
clock display (period 0, stopped) – already-logged events remain
unchanged. The length of a period can be adjusted via "Min./period"
(e.g. for youth teams with shorter game times).

The clock survives a page reload (the state lives on the server) and
stays in real-time sync across multiple devices/tabs – if, say, the
assistant coach is watching in parallel on their phone, they see
start/pause/period changes immediately. Deliberately no automatic stop
at 0:00 – the display stays at "00:00", the coach pauses and manually
switches to the next period once it's actually time.

## Live score

Right below the game title, a small display shows the current score
("Us 3 : 1 opponent name") – automatically calculated from the goal
events already logged, no separate input field needed for it. A goal
with no attribution or with one of your own roster players counts as
your own goal, a goal attributed to "Opponent" as a goal against. If
you delete a mistakenly logged goal, the score adjusts immediately.

## Game report (PDF export)

The "Export game report" button right next to the score generates a
print-friendly PDF summary: opponent/date, final score, the event
timeline (only the structured events, not the free-text notes), and
the match squad status. Meant for printing or handing to the
club/parents – not a replacement for the notes view on this page.

On the games overview (`/games`), "Export as CSV" additionally exports
all visible games (date, opponent, team, final score) as a CSV file –
for further processing in Excel/Sheets, an open format instead of an
on-screen table (see also [Statistics](./Statistiken.en.md) for the
CSV export of season metrics per player).

If an AI provider is configured on this instance, an "AI game
analysis" button also appears – see
[AI Assistants: Game Insights](./KI-Assistenten.en.md#game-insights-in-detail).

## Match squad

In addition to attendance (above), every game shows a "Match squad"
section: for each [roster player](./Kader.en.md), the coach decides
whether they're **playing**, a **reserve**, **injured**, or **absent**
– regardless of whether that player even has their own account
(unlike RSVP, which only works for team members with a login). A click
on ⟲ resets the status to "not decided". The match squad is
deliberately separate from [lines](./Lines.en.md): a line is a
cross-game tactical template, the match squad only applies to this one
game and doesn't change any line.

## Line statistics

Every line change during a game (see [lines](./Lines.en.md#active-line))
creates, in addition to the still-unchanged free-text note, a
structured, timestamped record of which line was "on the field" when.
Right below the line buttons, a "Line statistics" section shows, per
line: the time together (mm:ss, a "+" means the line is currently
active and the number keeps running live) and the goal ratio (own :
opponent goals) while that line was on the field. If the time shows
"unknown", there's not yet a completed phase for this line in this
game. Purely informational – it doesn't change the tactical template
itself.

## Shot tracking

In addition to the simple "Goal" preset (still unchanged, the fastest
option), there's a "Record shot" button for more detailed logging:
attribution (roster player, opponent, or none – for an opponent shot,
optionally also "our goalkeeper"), position on a simple,
floorball-specific zone diagram (close range center/left/right,
mid-range, long range – deliberately not an ice hockey field), shot
type (wrist shot, slap shot, one-timer, backhand), and outcome (goal,
saved, missed, blocked).

A shot with the outcome "goal" automatically updates the live score –
no separate additional entry needed. A single line appears for it on
the timeline ("Shot (goal) – ...").

For your own goal (not for an opponent's shot), an additional template
picker (assist) appears from this game's roster – the goal scorer
themselves isn't in that list. Assists feed into
[statistics](./Statistiken.en.md) (assists/points per player).
Deliberately only here, not in the quick "Goal" preset above – that
one stays the fastest, detail-free way to log things live.

Right below that, two more sections appear:

- **Shot statistics**: number of shots, shots on goal, goals, shot %,
  breakdown by zone, plus a shot map (the same zone graphic, now with
  a dot per shot – filled circle = goal, ring = saved, cross = missed,
  square = blocked).
- **Goalkeeper statistics**: only appears if at least one opponent shot
  has been attributed to a goalkeeper – shows shots on goal, saves,
  goals against, and save percentage per goalkeeper.

## Game videos and video linking

Below the statistics section, you can upload up to 5 videos per game
(format/size limits like [board videos](./Video-Integration.en.md),
but a separate, game-related video storage instead of attached to a
board) – e.g. the recording of the first and second half as two
separate clips. Drawing overlay, trimming, and scene markers work
identically to board videos.

You can also link the video's current playback position directly to an
already-logged event from the timeline: seek the video to the right
spot, select the event from the list, "Link current position". This
works **after the fact while reviewing footage post-game** just as
well as **live**, while a second device is already filming – this link
is the only case where an already-logged event can still be changed
(only the video link, not the event type/attribution/outcome – see
ADR-0005 in `docs/planning/DECISIONS.md`). A linked event shows a video
icon on the timeline; clicking it jumps directly to the linked spot in
the video.

## Technical note

The 10 fixed event buttons (kickoff periods 1–3, period end, timeout,
goal, 2/5-minute penalty, match penalty, game end) have been stored
**structurally** since the "Live match events" roadmap item (event
type + attribution as their own database fields instead of ready-made
text) – this is the foundation for later statistics (goals per player,
penalty minutes, score per period). Line changes are additionally
recorded in their own `match_lines` table (the basis for the line
statistics above). A goal logged via "Record shot" internally creates
two linked records (the detailed shot + a lean goal event for the
score) – invisible to the coach, only a single line appears on the
timeline for it. The free-text input field and the note on a line
change remain plain free text and continue to use the same comment
infrastructure as boards and training sessions. Both sources appear
together in one list, sorted by time – nothing changes in how the
coach uses it.

Events logged before this restructuring remain visible as frozen text
(no retroactive conversion).

## Related

- [Training planner](./Trainingsplaner.en.md)
- [Video integration](./Video-Integration.en.md) – drawing/trimming/
  markers, identical for board and game videos
