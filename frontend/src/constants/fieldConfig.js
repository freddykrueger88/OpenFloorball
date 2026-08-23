/**
 * IFF-konforme Spielfeld-Maße
 * Quelle: IFF Rulebook 2022, Section 1 – Playing Area
 * Alle Maße in Metern, werden intern auf Canvas-Pixel skaliert.
 *
 * Torraum (goalAreaWidth×goalAreaDepth) und Torwartfläche
 * (keeperWidth×keeperDepth) sind rechteckig, nicht halbrund – anders als
 * z.B. beim Fußball-Strafraum. Das Tor selbst liegt NICHT an der Bande,
 * sondern goalLineInset (2,85m Großfeld) davor – Floorball erlaubt
 * Weiterspielen hinter dem Tor, ähnlich wie beim Eishockey.
 */

export const IFF_FIELDS = {
  large: {
    id: 'large',
    label: 'Großfeld (40×20m)',
    labelEn: 'Full Field (40×20m)',
    width: 40,          // m
    height: 20,         // m
    boardHeight: 0.5,   // Bandenhöhe (visuell)
    goalWidth: 1.60,    // m (IFF: 160cm)
    goalDepth: 0.60,    // m (IFF: 60cm)
    goalAreaWidth: 4.0, // m (Torraum Breite)
    goalAreaDepth: 5.0, // m (Torraum Tiefe)
    keeperWidth: 1.0,   // m (Torwartfläche Breite)
    keeperDepth: 2.5,   // m (Torwartfläche Tiefe)
    goalLineInset: 2.85, // m (IFF: Torraum 2,85m von der Bande entfernt –
                          // Tor liegt NICHT an der Bande, Raum "hinter dem Tor"
                          // bleibt bespielbar)
    cornerRadius: 1.0,  // m (abgerundete Ecken)
    players: { home: 5, away: 5, goalkeepers: 2 },
  },
  small: {
    id: 'small',
    label: 'Kleinfeld (20×14m)',
    labelEn: 'Small Field (20×14m)',
    width: 20,
    height: 14,
    boardHeight: 0.5,
    goalWidth: 1.20,
    goalDepth: 0.40,
    goalAreaWidth: 3.0,
    goalAreaDepth: 3.5,
    keeperWidth: 0.8,
    keeperDepth: 1.8,
    goalLineInset: 1.4, // m (proportional zum Großfeld-Wert 2,85m/40m skaliert)
    cornerRadius: 0.75,
    players: { home: 4, away: 4, goalkeepers: 0 },
  },
  street: {
    id: 'street',
    label: 'Street Floorball (25×15m)',
    labelEn: 'Street Floorball (25×15m)',
    width: 25,
    height: 15,
    boardHeight: 0,
    goalWidth: 1.0,
    goalDepth: 0.3,
    goalAreaWidth: 2.5,
    goalAreaDepth: 3.0,
    keeperWidth: 0.6,
    keeperDepth: 1.5,
    goalLineInset: 1.8, // m (proportional zum Großfeld-Wert 2,85m/40m skaliert)
    cornerRadius: 0.5,
    players: { home: 3, away: 3, goalkeepers: 0 },
  },
  '3v3': {
    id: '3v3',
    label: '3vs3 (22×11m)',
    labelEn: '3 vs 3 (22×11m)',
    width: 22,
    height: 11,
    boardHeight: 0,
    goalWidth: 0.8,
    goalDepth: 0.25,
    goalAreaWidth: 2.0,
    goalAreaDepth: 2.5,
    keeperWidth: 0,
    keeperDepth: 0,
    goalLineInset: 1.6, // m (proportional zum Großfeld-Wert 2,85m/40m skaliert)
    cornerRadius: 0.4,
    players: { home: 3, away: 3, goalkeepers: 0 },
  },
};

/**
 * Kurz-Labels je Feldtyp (für Board-Kacheln/Postkarten – einzige Quelle,
 * damit Labels nicht in mehreren Komponenten dupliziert/inkonsistent werden)
 */
export const FIELD_TYPE_LABELS = {
  large:  'Großfeld',
  small:  'Kleinfeld',
  street: 'Street',
  '3v3':  '3vs3',
};

/**
 * Standard-Spielerfarben (IFF-konform)
 * Heim: dunkel/farbig, Auswärts: hell/weiß
 */
export const DEFAULT_TEAM_COLORS = {
  home: { fill: '#1d4ed8', stroke: '#1e40af', label: 'Heimteam' },
  away: { fill: '#dc2626', stroke: '#b91c1c', label: 'Auswärtsteam' },
  goalkeeper_home: { fill: '#4f46e5', stroke: '#3730a3', label: 'TW Heim' },
  goalkeeper_away: { fill: '#059669', stroke: '#047857', label: 'TW Auswärts' },
};

/**
 * IFF-Ballfarben (Official IFF Rules)
 * Ball muss kontrastreich zur Feldfläche sein
 */
export const IFF_BALL_COLORS = [
  { id: 'orange', label: 'Orange', hex: '#f97316', official: true },
  { id: 'yellow', label: 'Gelb', hex: '#eab308', official: true },
  { id: 'pink', label: 'Pink', hex: '#ec4899', official: true },
  { id: 'white', label: 'Weiß', hex: '#ffffff', official: true },
  { id: 'black', label: 'Schwarz (Street)', hex: '#1a1a1a', official: false },
];

/**
 * Standard-Spielerpositionen für das Großfeld (5+1) – Anstoß-/Bully-
 * Formation: alle Feldspieler stehen in der eigenen Hälfte (Heim: x<20,
 * Auswärts: x>20), nicht in der des Gegners.
 * Koordinaten in Meter (vom Mittelpunkt des Feldes)
 * x: horizontal, y: vertikal
 */
export const DEFAULT_POSITIONS_LARGE = {
  home: [
    { id: 'h1', role: 'TW', position: 'Torwart',     x: 2.0,  y: 10.0 },
    { id: 'h2', role: 'V',  position: 'Verteidiger',  x: 7.0,  y: 6.0  },
    { id: 'h3', role: 'V',  position: 'Verteidiger',  x: 7.0,  y: 14.0 },
    { id: 'h4', role: 'C',  position: 'Center',       x: 16.0, y: 10.0 },
    { id: 'h5', role: 'S',  position: 'Stürmer',      x: 18.0, y: 7.0  },
    { id: 'h6', role: 'S',  position: 'Stürmer',      x: 18.0, y: 13.0 },
  ],
  away: [
    { id: 'a1', role: 'TW', position: 'Torwart',     x: 38.0, y: 10.0 },
    { id: 'a2', role: 'V',  position: 'Verteidiger',  x: 33.0, y: 6.0  },
    { id: 'a3', role: 'V',  position: 'Verteidiger',  x: 33.0, y: 14.0 },
    { id: 'a4', role: 'C',  position: 'Center',       x: 24.0, y: 10.0 },
    { id: 'a5', role: 'S',  position: 'Stürmer',      x: 22.0, y: 7.0  },
    { id: 'a6', role: 'S',  position: 'Stürmer',      x: 22.0, y: 13.0 },
  ],
};

// Feldspieler-Slots (ohne TW) – TW wird nur ergänzt, wenn field.players.goalkeepers > 0
// xRatio < 0.5 = eigene Hälfte (Auswärts wird an 1-xRatio gespiegelt, bleibt
// dadurch ebenfalls in der eigenen Hälfte) – 0.50 stünde exakt auf der
// Mittellinie, das ist bewusst vermieden.
const FIELD_PLAYER_SLOTS = [
  { role: 'V', xRatio: 0.20, yOffsetRatio: -0.35 },
  { role: 'V', xRatio: 0.20, yOffsetRatio: 0.35 },
  { role: 'C', xRatio: 0.38, yOffsetRatio: 0 },
  { role: 'S', xRatio: 0.42, yOffsetRatio: -0.3 },
  { role: 'S', xRatio: 0.42, yOffsetRatio: 0.3 },
];

function buildMirroredPositions(field) {
  const { width: fieldWidth, height: fieldHeight, players } = field;
  const mid = fieldHeight / 2;

  const homeBase = [];
  let n = 1;
  if (players.goalkeepers > 0) {
    homeBase.push({ id: `h${n++}`, role: 'TW', x: fieldWidth * 0.07, y: mid });
  }
  for (const slot of FIELD_PLAYER_SLOTS.slice(0, players.home)) {
    homeBase.push({ id: `h${n++}`, role: slot.role, x: fieldWidth * slot.xRatio, y: mid + mid * slot.yOffsetRatio });
  }

  const awayBase = homeBase.map((p) => ({
    ...p,
    id: p.id.replace('h', 'a'),
    x: fieldWidth - p.x,
  }));

  return { home: homeBase, away: awayBase };
}

// Standard-Positionen je Feldtyp (Großfeld hand-kuratiert, Rest prozedural gespiegelt)
const DEFAULT_POSITIONS_BY_FIELD = {
  large:  DEFAULT_POSITIONS_LARGE,
  small:  buildMirroredPositions(IFF_FIELDS.small),
  street: buildMirroredPositions(IFF_FIELDS.street),
  '3v3':  buildMirroredPositions(IFF_FIELDS['3v3']),
};

/**
 * Baut das Standard-Spieler-Array (home, optional +away) für einen
 * Feldtyp auf – genutzt beim Anlegen des ersten Frames eines neuen
 * Boards. `includeAway` (Issue 025) steuert, ob die gegnerische
 * Aufstellung mit aufgenommen wird – Default `true`, damit bestehende
 * Aufrufer (Einzelspieler-Reset-Lookup gegen vorhandene Away-Ids)
 * unverändert funktionieren; neue Boards rufen explizit mit `false`.
 */
export function buildDefaultPlayers(fieldType, { includeAway = true } = {}) {
  const positions = DEFAULT_POSITIONS_BY_FIELD[fieldType] ?? DEFAULT_POSITIONS_BY_FIELD.large;
  const home = (positions.home ?? []).map((p) => ({ ...p, team: 'home' }));
  const away = includeAway ? (positions.away ?? []).map((p) => ({ ...p, team: 'away' })) : [];
  return ensureBall([...home, ...away], fieldType);
}

// ROADMAP-Backlog "beweglicher Ball": der Ball wird bewusst NICHT als
// eigenes Datenmodell/eigene Spalte eingeführt, sondern als Eintrag mit
// team:'ball' im selben players-Array wie die Spieler – dadurch
// funktionieren Drag & Drop (id-Match), Frame-Persistenz und die
// Frame-zu-Frame-Interpolation in useAnimation.js unverändert mit,
// ohne dass Backend/Datenmodell etwas davon wissen müssen.
export const BALL_ID = 'ball';

export function ensureBall(players = [], fieldType = 'large') {
  if (players.some((p) => p.team === 'ball')) return players;
  const field = IFF_FIELDS[fieldType] ?? IFF_FIELDS.large;
  return [...players, { id: BALL_ID, team: 'ball', role: null, x: field.width / 2, y: field.height / 2 }];
}

/**
 * Snapping-Raster
 */
export const GRID_SIZES = [
  { id: 'none',  label: 'Kein Raster',  value: 0      },
  { id: '0.5m',  label: '0.5m Raster', value: 0.5    },
  { id: '1m',    label: '1m Raster',   value: 1.0    },
  { id: '2m',    label: '2m Raster',   value: 2.0    },
];
