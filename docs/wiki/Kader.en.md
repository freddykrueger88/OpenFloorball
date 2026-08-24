# 👥 Roster

*[🇩🇪 Deutsch](Kader.md) | 🇬🇧 English*

A central player pool per account – maintain it once, then assign
players to any board, instead of typing names into every board
individually.

## Adding players

Under `/roster`:

- **Name**
- **Jersey number** (optional)
- **Role** (optional, free text field – e.g. position or function)

Maximum of **40 roster players** per account. Sorted by jersey number
by default, then by name.

## Assigning a player to a board

In the board editor, when clicking a player position: assign a roster
player via the info panel instead of typing a name manually. The name
(and jersey number, if set) then appears on the field once
[name display](./Einstellungen.en.md) is enabled.

## Relationship to boards

The roster is **independent of individual boards** within an account –
a player can be assigned to multiple boards at the same time. Deleting
a roster player doesn't automatically remove the names already entered
in existing boards (the most recently assigned name stays there as
plain text).

## Relationship to lines

Roster players are also the foundation for [lines](./Lines.en.md): a
line is a tactical combination of several roster players, and a player
can appear in any number of lines. Unlike the board assignment above,
this is a real link (not a text copy) – deleting a roster player
automatically removes them from every line they were part of.
