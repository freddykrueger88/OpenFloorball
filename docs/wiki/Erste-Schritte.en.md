# 🚀 Getting Started

*[🇩🇪 Deutsch](Erste-Schritte.md) | 🇬🇧 English*

A quick tour of OpenFloorball after [installation](./Installation-Docker.en.md).

## 1. Register

The **first registered account automatically becomes admin** – there's
no separate setup wizard. Open `http://localhost` (or your configured
`APP_PORT`), click **Register**, and set an email + password.

## 2. Guided tour

After your first login, a short, skippable-at-any-time onboarding tour
walks you through the main menu automatically. The main menu itself is
grouped into five areas (Boards, Roster, Games, Team, Knowledge)
instead of one long list of individual links – click any group to
expand it. You can restart the tour at any time from
[Settings](./Einstellungen.en.md).

The board editor has a second, independent tour covering the editor
tools (placing players, drawing, scenes/animation, saving, the Lines/
formation-templates/video tabs in the side panel, export) – reachable
again via the help icon (❓) in the top right of the editor, or from
Settings.

## 3. Create your first board

On the boards overview (`/boards`, the landing page after login),
click **New board**. You can choose:

- The board's **name**
- **Field type**: large (40×20m), small (20×14m), street floorball
  (25×15m), 3v3 (22×11m) – see [IFF field types](./IFF-Spielfelder.en.md)
- **Design/theme**: Dark, Light, Vikings, IFF
- Optionally: assign it to a [playbook](./Playbooks.en.md)

OpenFloorball automatically creates an IFF-compliant default lineup
(2‑1‑2 system, all field players in their own half) as the first
[frame](./Animation.en.md).

## 4. Build a play

In the board editor:

- Move players via drag & drop
- [Draw](./Spielzuege-Zeichnen.en.md) arrows/lines using the toolbar
  on the left
- Add more [frames](./Animation.en.md) to build a movement sequence
  (frame bar at the bottom)

Changes save automatically (visible via the save status in the
header).

## 5. Export or share

In the bottom tab menu (expand the "⚙️ Settings" tab for details):

- **GIF/MP4**: the movement sequence across all frames as a video
- **PDF**: a printable tactics sheet
- **Share link**: a publicly viewable link without login (expires
  automatically after `SHARE_LINK_EXPIRES_HOURS`)
- **Share board**: add another OpenFloorball user as a collaborator
  (see [Export & sharing](./Export.en.md))

## 6. Team & training

- [Roster](./Kader.en.md): a central player pool, maintain it once,
  assign it in any board
- [Lines](./Lines.en.md): tactical roster-player combinations, quickly
  switchable during a game
- [Training planner](./Trainingsplaner.en.md): combine multiple boards
  into a training session with duration/order
- [Live game notes](./Live-Spielnotizen.en.md): create games, capture
  timestamped notes while the game is on

## Next steps

- [Drawing plays](./Spielzuege-Zeichnen.en.md)
- [Frame-by-frame animation](./Animation.en.md)
- [Settings](./Einstellungen.en.md) (theme, language, font)
