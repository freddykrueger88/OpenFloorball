# 🎬 Frame-by-Frame Animation

*[🇩🇪 Deutsch](Animation.md) | 🇬🇧 English*

A board consists of a sequence of **frames** – each frame stores
player positions and drawn elements as its own state. Playback
smoothly interpolates player movement between frames; drawn
arrows/lines, on the other hand, hard cut in/out at each frame change
(no tweening for drawings).

## Managing frames

The frame bar sits above the bottom tab menu:

- **Add frame**: takes over the current player positions and drawing
  as the starting point for the new frame
- **Delete frame**
- **Reorder**: rearrange frames via drag & drop
- Clicking a frame jumps straight to it

## Playback

Controls sit directly below the header:

| Action | Shortcut |
|---|---|
| Play/Pause | `Space` |
| One frame forward (only while not playing) | `→` |
| One frame back (only while not playing) | `←` |

Also adjustable:

- **Speed**: 0.5×, 1×, 2×, 3×
- **Loop**: starts over after the last frame

## Saving

Changes to the active frame (player positions, drawings) are saved
automatically (debounced ~300ms after the last change, plus every
30s). When manually switching to another frame, an explicit save
happens first, so that very rapid successive actions never get lost.

## Exporting as video

A frame sequence can be exported as a **GIF** or **MP4** – see
[Export & sharing](./Export.en.md).
