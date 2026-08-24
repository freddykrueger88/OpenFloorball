# ⭐ Formation Templates

*[🇩🇪 Deutsch](Formationen.md) | 🇬🇧 English*

A formation stores a complete player lineup (positions of all players)
as a reusable template – independent of a specific board.

## Saving

In the bottom tab menu under "Formations": save the current lineup of
the currently open board under a name. The template is bound to the
**field type** it was saved with (large/small/street/3v3).

Maximum **20 formation templates** per account.

## Loading

Load a saved formation into any board:

- Same field type → positions are carried over 1:1
- Different field type → positions are scaled proportionally to the
  new field size

Loading overwrites the current player positions in the active frame
(not undoable except via `Ctrl+Z`, as long as you haven't left the
frame).

## Difference from lines and playbooks

| Concept | What it stores |
|---|---|
| **Formation** | A complete starting lineup (positions) |
| [**Line**](./Lines.en.md) | A tactical combination of real roster players (e.g. a forward line), not tied to a board |
| [**Playbook**](./Playbooks.en.md) | A themed collection of multiple boards |
