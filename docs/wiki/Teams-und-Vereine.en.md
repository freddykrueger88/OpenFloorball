# 👥 Teams and clubs

*[🇩🇪 Deutsch](Teams-und-Vereine.md) | 🇬🇧 English*

Two separate, hierarchically independent levels: **teams** (a single
squad) and **organizations** (a club with multiple teams).

## Teams

| Role | Permissions |
|---|---|
| owner | Everything, incl. managing members. Can't be removed/demoted as long as they're the only owner |
| coach | Create/edit team-shared content (roster, lines, games, playbooks, training plans, formations) |
| member | View only – for games/training sessions, additionally: confirm/decline their own attendance via [RSVP](./Live-Spielnotizen.en.md#attendance-rsvp) |

Inviting someone requires the invited person to **already have** an
OpenFloorball account – unlike board collaborators, there's no email
invite link for new users here.

## Organizations (clubs)

Same pattern, but only two roles (admin/member). A club consists of
multiple teams; org admins have read access into their club's teams,
but no automatic edit rights on their content.

Every club has its own dashboard (`/organizations/:id`, linked from
Settings → Organizations): rename the club (admin, via double-click),
member management (invite, change role, remove), and a "Teams in this
organization" section. There, org admins see all teams in their club
and can directly create a new team assigned to the club. Regular
members deliberately only see the teams they're themselves a member of
in this section (data minimization) – not automatically every team in
the club.

Also admin-only: "Upcoming dates across the club" – a bundled,
read-only overview of all upcoming games and training sessions across
every team in the club (e.g. for gym scheduling/date conflicts between
multiple squads like the 1st men's team and U15). No new editing path –
changes still happen within the respective team. Invisible to regular
members.

Also admin-only: "Who coaches where" – an overview of all head/
assistant coaches across every team in the club, grouped by team.
Purely informational (e.g. to see who coaches multiple squads at once),
no new editing path into other teams.

## Club-wide shared playbooks

A [playbook](./Playbooks.en.md) can be assigned to an entire club
instead of a single team (club admins only) – then visible to every
member of any team in that club, regardless of which squad. Handy for
a club-wide exercise collection that shouldn't be tied to a single
team.

## What's NOT tied to a team

Boards are deliberately **not** part of the team/club model. Whoever
should collaborate on a board is invited via
[board collaborators](./Export.en.md#share-board-collaborators) –
regardless of whether both people are on the same team. What CAN be
team-shared, on the other hand: roster entries, lines, games,
playbooks, formation templates, and training plans (each optional, via
`teamId`). If a game or training session is team-shared, the
[attendance list (RSVP)](./Live-Spielnotizen.en.md#attendance-rsvp) for
the whole team is then automatically available there too. Playbooks
can alternatively (not additionally) be assigned to an entire club
instead of a single team, see "Club-wide shared playbooks" above.

## Related pages

- [Export & sharing](./Export.en.md)
- [Roster](./Kader.en.md)
- [Lines](./Lines.en.md)
- [Training planner](./Trainingsplaner.en.md)
- [Live game notes](./Live-Spielnotizen.en.md)
