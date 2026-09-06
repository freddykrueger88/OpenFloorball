# 🧤 Goalie Tools

*🇩🇪 [Deutsch](Torhüter-Werkzeuge.md) | 🇬🇧 English*

Three goal-anchored drawing tools on the tactics board that visually
support the goalie coaching workflow (angles, rebounds, communication).
All three tools share the **goal selector** (automatic/next goal, or
explicitly left/right) and appear with their own layer toggle in the
visibility bar (currently 12 layers). They are only available in the
board editor, not in the video overlay.

## Tools

### Goalkeeper Angle (`W`)

Draws the **coverage triangle** from both goalposts to the chosen
goalkeeper position – the classic angle doctrine ("cut the angle").
The post geometry is derived from the current field configuration on
every render.

- Presets: starting position, counter up/down (one-click)
- Post scaling automatically adapts to field type (full/small/
  street/3v3)

### Rebound Zone (`R`)

Shades the **rebound control zone in front of a goal** as a trapezoid
– the goal mouth edge as the base, widening towards the chosen depth
point. Geometry is derived per field type from the current field
configuration (`computeReboundZone`), all points are clamped to the
playing field.

### Counter Clearance (`K`)

Bold, **dashed arrow from the goalkeeper** (anchor = goal line centre)
to the first pass target of the counter-attack, with a small
goalkeeper diamond at the anchor. Visually clearly distinguishable
from a normal pass.

### Goalkeeper Communication (`G`)

**Speech bubble with selectable command phrase** ("Press!", "Off!",
"Your ball!", "Position!", "Box!", "Stay!") at the addressed player
plus dashed connector to the goalkeeper anchor. Makes the
goalkeeper's vocal organization visible. The phrase text is baked in
on creation (offline-export compatible).

## Storage & Export

- All three tools are included in **GIF/MP4/PDF export** in parity
  with the live view
- Hidden in the **video overlay** (field geometry is unavailable there)
- Shared one-point coordinate form for all three tools, WCAG keyboard
  accessible

## Technical Details

- Geometry calculations in `angleMath.js`
- Phrase text is baked as `el.text` on creation (like comment pins)
  so the offline export can render without an i18n engine

---

> Changelog reference: Unreleased – Phase 1 (angle), Phase 2
> (rebound/counter), Phase 3 (communication), see
> [CHANGELOG.md](../../CHANGELOG.md)
