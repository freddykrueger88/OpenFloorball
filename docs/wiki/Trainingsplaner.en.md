# 📋 Training planner

*[🇩🇪 Deutsch](Trainingsplaner.md) | 🇬🇧 English*

A training plan ("training session") strings several existing boards
together into an exercise sequence with durations – e.g. warm-up
(board A, 10 min) → passing drill (board B, 15 min) → scrimmage (board
C, 20 min).

## Creating a training plan

Under `/trainings`:

1. Create a new training plan with a name
2. Add existing boards as exercises, each with:
   - **Duration** in minutes (default 15)
   - Optional **note** (e.g. the focus of the exercise)
3. Reorder via drag & drop

The total duration of the session is calculated automatically as the
sum of the exercise durations.

## Important: no copy

A training plan **references** existing boards instead of copying
them. Changes to a board therefore also affect every training plan
that contains it. If a board is deleted, the corresponding exercise
also disappears from every training plan.

## Recurring sessions

Once a training session has a date, a "Create series" button appears
below it. This lets you create follow-up sessions – daily, weekly, or
every 2 weeks, up to a chosen end date (max. 52 new sessions per run).

Every generated session is afterward a completely normal, standalone
training plan (name, goal, and note are copied from the source
session) – there's **no** ongoing link to the series. That means:

- A single session can be rescheduled, renamed, or deleted at any time
  without affecting the others (e.g. if a session falls on a holiday).
- Exercises (board references) are **not** copied along – the series
  only sets up the date skeleton, each session's content is planned
  individually.
- The total quota of training sessions per user is 200 (series
  included).

## Confirming attendance ahead of time (RSVP)

For a team-shared training session, an "Attendance" section appears
above the comments – identical to the RSVP section on the
[game page](./Live-Spielnotizen.en.md#attendance-rsvp): every team
member sees the full team list and responds for themselves with yes/
no/maybe, optionally with a reason for declining.

## Actual attendance

Independent of the RSVP confirmation (which is only a self-reported
statement BEFORE the session), the coach can record directly on the
training page, for every roster player, who actually showed up:
**Present**, **Excused**, **Unexcused**, or **Injured**. Clicking a
status sets it; clicking the reset icon again undoes it ("not
recorded").

This attendance feeds into the [player statistics](./Statistiken.en.md)
(participation rate, last-5/last-10/season trend) – the RSVP
confirmation itself is not evaluated there, since it's only an
intention, not confirmed attendance.

## Related

- [First steps](./Erste-Schritte.en.md)
- [Export & sharing](./Export.en.md) – exporting individual boards as PDF/GIF
- [Live game notes](./Live-Spielnotizen.en.md) – same attendance concept for games
