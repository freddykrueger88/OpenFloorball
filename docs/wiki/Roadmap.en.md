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

## Open backlog highlights (excerpt)

**Big undertaking:** statistics and performance analytics platform
(EPIC 012) – full audit/gap analysis and target architecture in
[docs/planning/STATISTICS_ANALYTICS_ARCHITECTURE.md](../planning/STATISTICS_ANALYTICS_ARCHITECTURE.md)
(German). Phase 1 (extensible event model) not yet implemented.

**Feature ideas:**
- Carpooling for games and trainings (backlog ISSUE 028) – team members
  offer rides to away games/trainings or claim a free seat on an
  existing offer. Open question before implementation: how to include
  parents without their own account, without having to store extra
  contact data (address/phone number).
- Europe-wide language support (backlog ISSUE 027) – the UI so far
  only German/English; phase 1 prioritizes the strongest floorball
  nations outside the DACH region (Swedish, Finnish, Czech, Slovak),
  every translation needs a native-speaker review before merging.
- Native app store presence (Google Play + Apple App Store) – the app
  is already an installable PWA (vite-plugin-pwa), so the obvious path
  would be a wrapper like Capacitor/Trusted Web Activity instead of a
  fully separate codebase.

**Technical:**
- Vite 7→8 (checked again as of 2026-08-07, still blocked: now
  `@vitejs/plugin-react@6` ↔ its optional peer dependency
  `@rolldown/plugin-babel` ↔ `@babel/core` – a different conflict than
  before, but still within the Rolldown ecosystem)
- ESLint 10 in the frontend (checked again as of 2026-08-07, still
  blocked: `eslint-plugin-react@7.37.5` declares a peer dependency of
  at most `eslint@^9.7`)
- Formal WCAG 2.1 AA / BITV 2.0 / EN 301 549 certification by a third
  party

All completed and planned milestones with details: see the linked
`ROADMAP.md` (German).
