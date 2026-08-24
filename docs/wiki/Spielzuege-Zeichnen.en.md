# ✏️ Drawing plays

*[🇩🇪 Deutsch](Spielzuege-Zeichnen.md) | 🇬🇧 English*

The drawing tools sit to the left of the field in the board editor
(scrollable when the bottom panel is expanded and space runs short).

## Tools

| Tool | Shortcut | Description |
|---|---|---|
| ← Select | `Esc` | Click/move elements, no drawing |
| ➡ Movement arrow | `M` | Shows where a player should move (solid line) |
| ⇢ Pass arrow | `P` | Pass between players (dashed) |
| ⚡ Shot arrow | `S` | Shot on goal (thick, solid) |
| ✏ Freehand | `F` | Free drawing for flexible markings |
| □ Eraser | `E` | Delete a single element by clicking it |

Color and line thickness (thin/medium/thick) can be freely chosen,
independent of the selected tool.

## Drawing by coordinates

In the bottom tab menu (the "Draw" tab), an arrow or freehand line can
also be created via exact start/end coordinates (in meters) instead of
mouse/touch – useful for precise diagrams and for purely
keyboard-driven use (accessibility).

## Undo / redo

- `Ctrl+Z` / `Cmd+Z` – undo
- `Ctrl+Y` or `Ctrl+Shift+Z` – redo
- `Del`/`Backspace` – delete the selected element

The history is visible as a list in the toolbar; clicking an entry
jumps directly to that state.

## Frame association

Drawn elements belong to the **currently active frame** – switching to
another frame makes the drawing disappear there (each frame has its
own elements).

When **creating a new frame** (the "Frame" button in the timeline), the
current player positions are always carried over, but drawings are
**not** by default – a new frame is usually a new game situation where
old arrows rarely still apply. Right next to the "Frame" button, a
small toggle (pencil icon) reverses this if a drawing should actually
persist across multiple frames (e.g. a zone marker). For a drawing that
should only appear in one single additional frame, it can of course
also simply be recreated there. Details on frames:
[Frame-by-frame animation](./Animation.en.md).

## Changing the field size

Switching the field type (Settings tab) automatically scales player
positions and drawn elements proportionally to the new field
dimensions.
