# 📚 Playbooks (board collections)

*[🇩🇪 Deutsch](Playbooks.md) | 🇬🇧 English*

A playbook groups multiple boards by theme, e.g. "Power play",
"Standard situations", or "Opponent XY". Purely organizational –
doesn't change the boards themselves.

## Creating and assigning

- Playbooks are created independently of boards (just a name)
- When creating or editing a board, it can be assigned to a playbook
  (optional, changeable later too)
- Maximum of **15 playbooks** per account
- A playbook has exactly one visibility scope: **personal**, shared
  with a **team**, or – new, EPIC 011 – **club-wide** across all teams
  of a club. Creating a club-wide playbook is reserved for club
  admins (a plain team-coach permission isn't enough for this, since
  the visibility extends beyond your own team) – it's then visible to
  every member of any team in the club, without that person having to
  be individually invited as a club member. As with the team-shared
  playbook: only the playbook **name**/collection is shared, not
  automatically access to the individual boards inside it (those
  remain separately protected via
  [board collaborators](./Export.en.md#share-board-collaborators)).

## Filtering

On the boards overview, you can filter by playbook to quickly see only
the boards for a specific theme.

## Deleting a playbook

Only deletes the grouping – contained boards are kept and simply no
longer assigned to any playbook (`playbook_id` is set to `NULL`).

## Related

- [First steps](./Erste-Schritte.en.md)
- [Formations](./Formationen.en.md) – templates for starting lineups
  (a different concept)
