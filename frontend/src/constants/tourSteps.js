/**
 * tourSteps – Schrittlisten für die beiden Touren (ISSUE 023 Nav-Tour,
 * ISSUE 024 Editor-Tour), zentral statt inline in App.jsx/
 * BoardEditorPage.jsx – beide Dateien sind bereits umfangreich genug.
 * `target` verweist auf ein `data-tour`-Attribut (Header.jsx bzw.
 * BoardEditorPage.jsx/BoardSidePanelTabs.jsx/FrameTimeline.jsx),
 * `target: null` zeigt nur den abgedunkelten Hintergrund ohne Spotlight
 * (Willkommen-/Abschluss-Schritt).
 */

export const NAV_TOUR_STEPS = [
  { target: null,             titleKey: 'tour.welcomeTitle',   bodyKey: 'tour.welcomeBody' },
  { target: 'nav-boards',     titleKey: 'tour.boardsTitle',    bodyKey: 'tour.boardsBody' },
  { target: 'nav-trainings',  titleKey: 'tour.trainingsTitle', bodyKey: 'tour.trainingsBody' },
  { target: 'nav-library',    titleKey: 'tour.libraryTitle',   bodyKey: 'tour.libraryBody' },
  { target: 'nav-settings',   titleKey: 'tour.settingsTitle',  bodyKey: 'tour.settingsBody' },
  { target: null,             titleKey: 'tour.doneTitle',      bodyKey: 'tour.doneBody' },
];

export const EDITOR_TOUR_STEPS = [
  { target: null,               titleKey: 'editorTour.welcomeTitle', bodyKey: 'editorTour.welcomeBody' },
  { target: 'editor-canvas',    titleKey: 'editorTour.canvasTitle',  bodyKey: 'editorTour.canvasBody' },
  { target: 'editor-tab-draw',  titleKey: 'editorTour.drawTitle',    bodyKey: 'editorTour.drawBody' },
  { target: 'editor-frames',    titleKey: 'editorTour.framesTitle',  bodyKey: 'editorTour.framesBody' },
  { target: 'editor-save',      titleKey: 'editorTour.saveTitle',    bodyKey: 'editorTour.saveBody' },
  { target: 'editor-tab-export', titleKey: 'editorTour.exportTitle', bodyKey: 'editorTour.exportBody' },
  { target: null,               titleKey: 'editorTour.doneTitle',    bodyKey: 'editorTour.doneBody' },
];
