# 📅 Calendar

*[🇩🇪 Deutsch](Kalender.md) | 🇬🇧 English*

Under `/calendar`, [games](./Live-Spielnotizen.en.md) and
[training sessions](./Trainingsplaner.en.md) appear together in a
month view – color-coded (games orange, trainings blue). Clicking an
entry opens its detail page.

## Scope (deliberately kept simple)

A pure view of already-existing entries, no separate data model of its
own: a game/training session only needs a date set (opponent date or
planned training date) to show up. Without a date, an entry doesn't
appear in the calendar, but stays visible as normal in its respective
list view (`/games`, `/trainings`).

Currently month view only (no week view) – that's its own, larger
backlog item. Recurring training series already exist (see
[Training planner](./Trainingsplaner.en.md#recurring-sessions)) –
generated follow-up sessions automatically show up here in the
calendar too.

## Calendar subscription (ICS export)

Below the month grid, you can generate a personal calendar feed that
subscribes to games and training sessions with a set date in Google
Calendar, Apple Calendar, or Outlook. The external calendar polls the
URL itself on a regular basis – new or changed entries appear there
automatically, without you having to export anything.

- **Subscribe** opens the calendar client directly via the `webcal://`
  scheme (works in most calendar apps with no further step).
- The plain `https://` URL can also be copied – needed for calendars
  that only offer the manual "subscribe from URL" path (e.g. Google
  Calendar on desktop).
- **Regenerate** fully replaces the existing link; the old URL stops
  working afterward.
- **Revoke** disables the feed entirely, until a new one is generated.

The link itself doesn't require login – whoever knows it can read the
entries visible through it (opponent/training names and dates), but
can't change anything. As with board share links: don't share the
link publicly if the entries shouldn't be visible to third parties.

## Related

- [Live game notes](./Live-Spielnotizen.en.md)
- [Training planner](./Trainingsplaner.en.md)
