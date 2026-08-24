# 🎥 Video integration

*[🇩🇪 Deutsch](Video-Integration.md) | 🇬🇧 English*

Up to 5 short video clips per board (e.g. a specific play by the
opponent), playable via the browser's native player.

The same drawing/trimming/marker functionality is also available for
**game videos** (a video attached directly to a game instead of a
board, with its own storage/access rights via the
[game's team access](./Live-Spielnotizen.en.md) instead of board
collaborators) – see
[Live game notes: game videos and event linking](./Live-Spielnotizen.en.md#game-videos-and-video-linking)
for the additional option of linking a video position to an event from
the game timeline. The rest of this page's description (upload limits,
drawing, trimming, markers, "video → tactics board") applies to both
equally.

## Upload and playback

| Limit | Value |
|---|---|
| Formats | MP4, WebM, MOV |
| Max. file size | 200 MB (default, changeable via `MAX_VIDEO_SIZE_MB`) |
| Max. videos per board | 5 |

Playback supports range requests (seeking forward/backward without a
full re-download). Access works like other board resources: read
access is enough to watch, editing/deleting needs write access (like
[board collaborators](./Export.en.md#share-board-collaborators)).

## Drawing, trimming, markers

- **Drawing overlay**: place tactical elements directly over the video.
- **Trimming**: set start/end points without modifying the original
  file.
- **Scene markers**: labeled timestamps to quickly find important
  moments in the clip again.

## Video → tactics board

A video overlay created with the drawing tools can be turned into a
new, standalone board with one click on "Convert to tactics board" –
the situation doesn't have to be rebuilt by hand. The new board
inherits the field type and colors of the source board; a note in the
notes field references the source video. Only the already-saved
drawing (arrows/freehand) is carried over, not a video still frame.

## Storage

Videos are stored as files on disk (`VIDEOS_DIR`, a Docker volume), not
as database blobs – the same approach as the temporary export files.
Deleting the board (or, for game videos: deleting the game) also
removes the associated video files.

## Related pages

- [Export & sharing](./Export.en.md)
- [Live game notes](./Live-Spielnotizen.en.md) – game videos and event
  linking
