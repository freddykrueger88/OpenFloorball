# 📤 Export & Sharing

*[🇩🇪 Deutsch](Export.md) | 🇬🇧 English*

All options are in the "Export" tab of the bottom menu in the board
editor.

## GIF / MP4

Renders the frame sequence as a video file (via FFmpeg on the
backend).

| Option | Values |
|---|---|
| Format | GIF or MP4 |
| FPS | 1–15 |
| Width | 480 / 720 / 1280 px |
| Loop (GIF only) | on/off |
| Watermark (MP4 only) | on/off |

At least 2 frames required, maximum 60 frames per export. The export
runs asynchronously (status polling); the finished file is then
available for download for 24h, after which it's removed
automatically.

## PDF tactics sheet

Renders one or more frames as a print-ready PDF.

| Option | Values |
|---|---|
| Frames per page | 1, 2, or 4 |
| Paper size | A4 or Letter |

Runs synchronously (no job status needed), direct download.

## Share link (public, no login)

Creates a public link to a read-only view of the board – e.g. to show
players a play without them needing their own OpenFloorball account.
The link expires automatically after `SHARE_LINK_EXPIRES_HOURS`
(default 72h) and can't be opened after that.

For a single frame (instead of the whole board) there's also a
dedicated frame share link: it creates a rendered PNG image (max. 5 MB)
with its own token, independent of the board link.

## Share board (collaborators)

Unlike the public link: **another registered OpenFloorball user** gets
permanent access to the board.

- **Permission levels**: read or edit
- Maximum 10 collaborators (including open invites) per board
- If [SMTP is configured](./E-Mail-Versand.en.md), the added person
  gets a short notification email

Only the board owner can manage collaborators (add, change
permissions, remove).

**Does the invited email address not have an account yet?** Then the
invite is stored as a pending invite – as soon as that address
registers, it's automatically added as a collaborator on the
respective board, with no further action needed from the owner.
