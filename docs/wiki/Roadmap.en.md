# 🗺️ Roadmap

*[🇩🇪 Deutsch](Roadmap.md) | 🇬🇧 English*

The full, long-term roadmap and backlog live in the repository and are
continuously updated there (German):

👉 **[docs/planning/ROADMAP.md](../planning/ROADMAP.md)** (vision/phases)
👉 **[docs/planning/BACKLOG.md](../planning/BACKLOG.md)** (individual issues)

## Already implemented (former backlog items)

- **Video integration** – upload/play video clips per board, incl.
  drawing overlay, trimming, scene markers, and turning a video drawing
  into a new tactics board. See
  [Video integration](./Video-Integration.en.md).
- **Live game notes** ("Extension: live support") – create games and
  capture quick, timestamped notes while a game is in progress. See
  [Live game notes](./Live-Spielnotizen.en.md).
- **Manual backup trigger** – "Run now" button in the admin area for
  an immediate backup run independent of the schedule. See
  [Backup](./Backup.en.md).
- **Lines fundamentally reworked** (conceptual overhaul) – lines used
  to be purely board-internal highlight groups with no connection to
  the roster; now they're real tactical roster-player combinations (a
  player can be in any number of lines), with quick switching right on
  the game page. See [Lines](./Lines.en.md).
- **Real-time collaboration** – presence indicator and live cursors
  while jointly editing a board. See
  [Real-time collaboration](./Echtzeit-Zusammenarbeit.en.md).
- **Onboarding tour** (backlog ISSUE 023) – short, skippable
  introduction tour on first login.
- **In-depth editor tour** (backlog ISSUE 024) – a second, independent
  tour right in the board editor, explaining the concrete tools
  (placing players, drawing, scenes/animation, automatic saving,
  export/sharing). Re-openable at any time via the help icon in the
  editor.
- **Carpooling for games and trainings** (backlog ISSUE 028) – attach
  ride offers (free seats) to games/trainings, claim a seat without
  overbooking, plus a public share page via `share_token`. See
  ISSUE 030 (offerer name). The open question (parents without their
  own account) is intentionally deferred until clarified with clubs.
- **Statistics and performance analytics** (EPIC 012) – phases 1–9 fully
  implemented (events model, line tracking, shot tracking, special
  teams, training analytics, video↔event, assists/CSV export, line
  chemistry, AI insights) including the opponent entity
  ([statistics architecture](../planning/STATISTICS_ANALYTICS_ARCHITECTURE.md),
  German). xG/shot quality intentionally deferred (no real data basis),
  as is season/competition grouping of games.

## Open backlog highlights (excerpt)

**Feature ideas:**
- Europe-wide language support (backlog ISSUE 027) – phases 1 and 2 are
  complete as AI drafts: Swedish (`sv`), Finnish (`fi`), Czech (`cs`),
  Slovak (`sk`), Norwegian Bokmål (`nb`), Latvian (`lv`), Polish (`pl`)
  and French (`fr`) are selectable in the UI (marked
  `needs-native-review`); phase 3 (`da`/`et`/`nl`/`it`) on demand. Every
  translation needs a native-speaker review before official closing.
- Season/competition grouping of games (deliberately excluded from
  EPIC 012) – a larger standalone topic.
- Native app store presence (Google Play + Apple App Store) – the app
  is already an installable PWA (vite-plugin-pwa), so the obvious path
  would be a wrapper like Capacitor/Trusted Web Activity instead of a
  fully separate codebase.

**Technical:**
- ESLint 10 in the frontend (checked again as of 2026-09-05, still
  blocked: `eslint-plugin-react@7.37.5` declares a peer dependency of
  at most `eslint@^9.7`)
- Formal WCAG 2.1 AA / BITV 2.0 / EN 301 549 certification by a third
  party

All completed and planned milestones with details: see the linked
`ROADMAP.md` (German).
