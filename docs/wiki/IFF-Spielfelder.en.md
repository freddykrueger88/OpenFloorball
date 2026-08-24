# 🏟️ Field Types & Dimensions

*[🇩🇪 Deutsch](IFF-Spielfelder.md) | 🇬🇧 English*

OpenFloorball supports four field types, all modeled after the **IFF
rulebook** (International Floorball Federation). Source: IFF Rulebook,
Section 1 – Playing Area.

> 💡 The same rule essentials (field types, ball, positions) are also
> viewable interactively directly in the app under `/rules`.

| Field type | Dimensions | Goal (W×H) | Players per team |
|---|---|---|---|
| Large | 40 × 20 m | 1.60 × 0.60 m | 5 field players + 1 goalkeeper |
| Small | 20 × 14 m | 1.20 × 0.40 m | 4 field players (no goalkeeper) |
| Street floorball | 25 × 15 m | 1.00 × 0.30 m | 3 field players (no goalkeeper) |
| 3v3 | 22 × 11 m | 0.80 × 0.25 m | 3 field players (no goalkeeper) |

## Special case: space behind the goal

Unlike, say, a soccer penalty area, the goal crease is rectangular, not
semicircular. On the large field, the goal sits **2.85 m from the
boards** (not directly against them) – similar to ice hockey, the
space behind the goal stays in play. The other field types use a
proportionally scaled distance.

## Corners

All field types have rounded corners (large field: 1 m radius,
proportionally smaller for the other field types).

## Default starting lineup

When creating a new board, an IFF-compliant kickoff formation is
automatically applied: all field players stand in their own half
(2-1-2 system on the large field: 2 defenders, 1 center, 2 attackers).
Details on positions: [Positions & roles](./IFF-Positionen.en.md).
