/**
 * Zeichen-Tool Definitionen
 * Alle verfügbaren Werkzeuge, ihre Eigenschaften und Tastaturkürzel
 */

export const TOOLS = {
  select: {
    id: 'select',
    label: 'Auswahl',
    labelEn: 'Select',
    icon: '←',
    shortcut: 'Escape',
    cursor: 'default',
  },
  move: {
    id: 'move',
    label: 'Bewegungspfeil',
    labelEn: 'Movement Arrow',
    icon: '➡',
    shortcut: 'M',
    cursor: 'crosshair',
    arrowHead: true,
    dash: [],
    strokeWidth: 3,
    description: 'Zeigt wohin sich ein Spieler bewegen soll',
  },
  pass: {
    id: 'pass',
    label: 'Pass-Pfeil',
    labelEn: 'Pass Arrow',
    icon: '⇢',
    shortcut: 'P',
    cursor: 'crosshair',
    arrowHead: true,
    dash: [12, 8],
    strokeWidth: 2,
    description: 'Zeigt einen Pass zwischen Spielern',
  },
  shot: {
    id: 'shot',
    label: 'Schuss-Pfeil',
    labelEn: 'Shot Arrow',
    icon: '⚡',
    shortcut: 'S',
    cursor: 'crosshair',
    arrowHead: true,
    dash: [],
    strokeWidth: 5,
    description: 'Zeigt einen Schuss aufs Tor',
  },
  freehand: {
    id: 'freehand',
    label: 'Freihand',
    labelEn: 'Freehand',
    icon: '✏',
    shortcut: 'F',
    cursor: 'crosshair',
    arrowHead: false,
    dash: [],
    strokeWidth: 2,
    description: 'Freies Zeichnen für flexible Markierungen',
  },
  zone: {
    id: 'zone',
    label: 'Trainingszone',
    labelEn: 'Training zone',
    icon: '▭',
    shortcut: 'Z',
    cursor: 'crosshair',
    dash: [],
    strokeWidth: 2,
    fillOpacity: 0.25,
    description: 'Markiert eine Fläche auf dem Feld (z.B. Pressing-Zone)',
  },
  // Torwart-Winkel (CLAUDE.md §9.7): zeichnet das Abdeckungs-Dreieck von
  // den Torpfosten eines Tores zu einem Punkt (Torwart-Standort). scalar
  // Zwei-Punkte-Element wie Pfeil/Zone, `goalSide` steuert das Ziel-Tor
  // (siehe utils/angleMath.js).
  winkel: {
    id: 'winkel',
    label: 'Torwart-Winkel',
    labelEn: 'Goalkeeper Angle',
    icon: '△',
    shortcut: 'W',
    cursor: 'crosshair',
    arrowHead: false,
    dash: [],
    strokeWidth: 2,
    fillOpacity: 0.3,
    description: 'Zeigt den Abdeckungs-Winkel eines Torwarts von einer Position aus',
  },
  // Rebound-Raum (CLAUDE.md §9.7): tor-verankertes Trapez VOR dem Tor, das
  // die Tormaulkante als Grundseite nutzt und zur gewählten Tiefe hin
  // breiter wird (Abprall-Kegel) – "wo Abpraller entschärft werden müssen".
  // Nur ein Tiefenpunkt nötig; die breite Kante wird beim Rendern pro
  // Feldtyp aus computeReboundZone() abgeleitet.
  rebound: {
    id: 'rebound',
    label: 'Rebound-Raum',
    labelEn: 'Rebound zone',
    icon: '◭',
    shortcut: 'R',
    cursor: 'crosshair',
    arrowHead: false,
    dash: [],
    strokeWidth: 2,
    fillOpacity: 0.2,
    description: 'Markiert den Raum vor dem Tor, in dem Abpraller kontrolliert werden',
  },
  // Konterauslösung (CLAUDE.md §9.7): fetter, gestrichelter Pfeil vom
  // Torwart (Anker = Torlinien-Mitte, s. getKeeperClearancePoint) zur
  // ersten Anspielstation des Konterangriffs. Tor-verankert wie Winkel/
  // Rebound: nur der Zielpunkt (x2/y2) wird gespeichert und beim Rendern
  // die Startposition aus der Feldkonfiguration abgeleitet.
  konter: {
    id: 'konter',
    label: 'Konterauslösung',
    labelEn: 'Counter trigger',
    icon: '⤳',
    shortcut: 'K',
    cursor: 'crosshair',
    arrowHead: true,
    dash: [14, 8],
    strokeWidth: 5,
    description: 'Zeigt, wohin der Torwart den Ball zum Konter auslöst',
  },
  // Torwart-Kommunikation (CLAUDE.md §9.7): Sprechblase vom Torwart zu
  // einem angesprochenen Spieler inkl. wählbarer Kommando-Phrase (z.B.
  // "Raus!", "Du hast ihn!"). Tor-verankert wie Winkel/Rebound/Konter –
  // der Anker sitzt am Torwart, die Blase erscheint am gewählten
  // Anspielpunkt; der Phrasentext wird beim Anlegen eingebrannt (wie bei
  // Kommentar-Pins), damit auch der Offline-Export ihn ohne i18n kennt.
  komm: {
    id: 'komm',
    label: 'Torwart-Kommunikation',
    labelEn: 'Goalkeeper Communication',
    icon: '❝',
    shortcut: 'G',
    cursor: 'crosshair',
    arrowHead: false,
    dash: [4, 2],
    strokeWidth: 2,
    description: 'Zeigt, welches Kommando der Torwart an wen richtet',
    bubbleWidth: 220,
    bubbleHeight: 60,
    bubbleFontSize: 15,
  },
  // Layer-System (CLAUDE.md §10.2): erzeugt bewusst KEIN Frame-Element
  // (kein Eintrag in useDrawing.js' elements-Array) – ein Klick mit
  // diesem Werkzeug öffnet stattdessen einen Dialog zum Anpinnen eines
  // echten Kommentars (siehe BoardEditorPage.jsx/AddCommentPinDialog.jsx).
  comment: {
    id: 'comment',
    label: 'Kommentar anpinnen',
    labelEn: 'Pin comment',
    icon: '💬',
    shortcut: 'C',
    cursor: 'crosshair',
    description: 'Pinnt einen Kommentar an eine Position auf dem Feld',
  },
  eraser: {
    id: 'eraser',
    label: 'Radierer',
    labelEn: 'Eraser',
    icon: '□',
    shortcut: 'E',
    cursor: 'pointer',
    description: 'Einzelne Elemente löschen (Klick)',
  },
};

export const TOOL_ORDER = ['select', 'move', 'pass', 'shot', 'freehand', 'zone', 'winkel', 'rebound', 'konter', 'komm', 'comment', 'eraser'];

// Torhüter-Werkzeuge (CLAUDE.md §9.7): alle tor-verankert, d.h. sie hängen
// an der Pfostengeometrie eines gewählten Tores (goalSide am Element) und
// sind ohne Feld-Konfiguration nicht sinnvoll renderbar (Video-Overlay
// blendet sie per DrawingToolbar-hideTools aus).
export const GOALKEEPER_TOOLS = ['winkel', 'rebound', 'konter', 'komm'];

// Kommando-Phrasen für die Torwart-Kommunikation (§9.7): labelKey zeigt
// auf i18n-Slot drawing.kommPhrases.<key>; der gewählte Text wird beim
// Anlegen eingebrannt (Element.text), siehe useDrawing.js.
export const KOMM_PHRASES = [
  { key: 'press',    labelKey: 'drawing.kommPhrases.press' },
  { key: 'raus',     labelKey: 'drawing.kommPhrases.raus' },
  { key: 'du',       labelKey: 'drawing.kommPhrases.du' },
  { key: 'stellung', labelKey: 'drawing.kommPhrases.stellung' },
  { key: 'box',      labelKey: 'drawing.kommPhrases.box' },
  { key: 'ruhig',    labelKey: 'drawing.kommPhrases.ruhig' },
];

export const KOMM_DEFAULT_PHRASE_KEY = 'press';

export const DEFAULT_COLORS = [
  { hex: '#facc15', label: 'Gelb',    labelEn: 'Yellow' },
  { hex: '#f97316', label: 'Orange',  labelEn: 'Orange' },
  { hex: '#ef4444', label: 'Rot',     labelEn: 'Red' },
  { hex: '#22c55e', label: 'Grün',    labelEn: 'Green' },
  { hex: '#3b82f6', label: 'Blau',    labelEn: 'Blue' },
  { hex: '#a855f7', label: 'Lila',    labelEn: 'Purple' },
  { hex: '#ffffff', label: 'Weiß',    labelEn: 'White' },
  { hex: '#000000', label: 'Schwarz', labelEn: 'Black' },
];

export const STROKE_WIDTHS = [
  { value: 1, label: 'Dünn',  labelEn: 'Thin' },
  { value: 2, label: 'Mittel', labelEn: 'Medium' },
  { value: 4, label: 'Dick',   labelEn: 'Thick' },
  { value: 7, label: 'Extra',  labelEn: 'Extra' },
];

export const MAX_UNDO_STEPS = 50;
