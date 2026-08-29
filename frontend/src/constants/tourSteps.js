/**
 * tourSteps – Schrittlisten für die beiden Touren (ISSUE 023 Nav-Tour,
 * ISSUE 024 Editor-Tour), zentral statt inline in App.jsx/
 * BoardEditorPage.jsx – beide Dateien sind bereits umfangreich genug.
 * `target` verweist auf ein `data-tour`-Attribut (Header.jsx bzw.
 * BoardEditorPage.jsx/BoardSidePanelTabs.jsx/FrameTimeline.jsx),
 * `target: null` zeigt nur den abgedunkelten Hintergrund ohne Spotlight
 * (Willkommen-/Abschluss-Schritt).
 *
 * Ausbau 2026-08-28: das Hauptmenü (Header.jsx) wurde von 13 flachen
 * Links auf 5 gruppierte Dropdowns umgestellt (nur so bleiben alle
 * Bereiche in der Tour abbildbar, ohne dass jeder einzelne der 13 Links
 * einen eigenen Tour-Schritt bräuchte) – die Nav-Tour zeigt jetzt auf
 * die Gruppen-Trigger (`nav-group-*`) statt auf einzelne Unterpunkte.
 * Die Editor-Tour deckt zusätzlich die zuvor fehlenden Tabs Linien/
 * Formationsvorlagen/Video ab.
 *
 * Ausbau 2026-08-29 (Onboarding-Ausbau: Lexikon/Demo-Daten): ein
 * zusätzlicher Backdrop-Schritt vor "Einstellungen" erklärt die neu
 * angelegte Demo-Testumgebung, statt die bereits fünf gruppierten
 * Schritte auf die im Original-Auftrag vorgeschlagenen zehn Einzelschritte
 * aufzublähen – das Lexikon wird stattdessen im bestehenden
 * "Wissen"-Gruppenschritt mit erwähnt (siehe knowledgeGroupBody).
 */

export const NAV_TOUR_STEPS = [
  { target: null,               titleKey: 'tour.welcomeTitle',      bodyKey: 'tour.welcomeBody' },
  { target: 'nav-group-boards',    titleKey: 'tour.boardsGroupTitle',    bodyKey: 'tour.boardsGroupBody' },
  { target: 'nav-group-roster',    titleKey: 'tour.rosterGroupTitle',    bodyKey: 'tour.rosterGroupBody' },
  { target: 'nav-group-games',     titleKey: 'tour.gamesGroupTitle',     bodyKey: 'tour.gamesGroupBody' },
  { target: 'nav-group-team',      titleKey: 'tour.teamGroupTitle',      bodyKey: 'tour.teamGroupBody' },
  { target: 'nav-group-knowledge', titleKey: 'tour.knowledgeGroupTitle', bodyKey: 'tour.knowledgeGroupBody' },
  { target: null,               titleKey: 'tour.demoDataTitle',     bodyKey: 'tour.demoDataBody' },
  { target: 'nav-settings',     titleKey: 'tour.settingsTitle',     bodyKey: 'tour.settingsBody' },
  { target: null,               titleKey: 'tour.doneTitle',         bodyKey: 'tour.doneBody' },
];

export const EDITOR_TOUR_STEPS = [
  { target: null,                    titleKey: 'editorTour.welcomeTitle',     bodyKey: 'editorTour.welcomeBody' },
  { target: 'editor-canvas',         titleKey: 'editorTour.canvasTitle',      bodyKey: 'editorTour.canvasBody' },
  { target: 'editor-tab-draw',       titleKey: 'editorTour.drawTitle',        bodyKey: 'editorTour.drawBody' },
  { target: 'editor-frames',         titleKey: 'editorTour.framesTitle',      bodyKey: 'editorTour.framesBody' },
  { target: 'editor-save',           titleKey: 'editorTour.saveTitle',        bodyKey: 'editorTour.saveBody' },
  { target: 'editor-tab-lines',      titleKey: 'editorTour.linesTitle',       bodyKey: 'editorTour.linesBody' },
  { target: 'editor-tab-formations', titleKey: 'editorTour.formationsTitle',  bodyKey: 'editorTour.formationsBody' },
  { target: 'editor-tab-video',      titleKey: 'editorTour.videoTitle',       bodyKey: 'editorTour.videoBody' },
  { target: 'editor-tab-export',     titleKey: 'editorTour.exportTitle',      bodyKey: 'editorTour.exportBody' },
  { target: null,                    titleKey: 'editorTour.doneTitle',        bodyKey: 'editorTour.doneBody' },
];
