/**
 * defaultPositions – Standard-Spielerpositionen je Feldtyp
 *
 * Portierte Kopie der Positions-Logik aus
 * frontend/src/constants/fieldConfig.js (DEFAULT_POSITIONS_LARGE,
 * FIELD_PLAYER_SLOTS, buildMirroredPositions, buildDefaultPlayers).
 * Frontend und Backend sind getrennte Node-Packages ohne gemeinsames
 * Shared-Package – daher bewusste Duplikation. MUSS synchron zu
 * frontend/src/constants/fieldConfig.js gehalten werden, falls sich
 * Feldtypen, Feldmaße oder die Standardaufstellung ändern.
 */

const FIELD_DIMENSIONS = {
  large:  { width: 40, height: 20, players: { home: 5, away: 5, goalkeepers: 2 } },
  small:  { width: 20, height: 14, players: { home: 4, away: 4, goalkeepers: 0 } },
  street: { width: 25, height: 15, players: { home: 3, away: 3, goalkeepers: 0 } },
  '3v3':  { width: 22, height: 11, players: { home: 3, away: 3, goalkeepers: 0 } },
};

const DEFAULT_POSITIONS_LARGE = {
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

const DEFAULT_POSITIONS_BY_FIELD = {
  large:  DEFAULT_POSITIONS_LARGE,
  small:  buildMirroredPositions(FIELD_DIMENSIONS.small),
  street: buildMirroredPositions(FIELD_DIMENSIONS.street),
  '3v3':  buildMirroredPositions(FIELD_DIMENSIONS['3v3']),
};

/**
 * Baut das Standard-Spieler-Array (home, optional +away) für einen
 * Feldtyp auf – genutzt beim Anlegen des ersten Frames eines neuen
 * Boards. `includeAway` (Issue 025) steuert, ob die gegnerische
 * Aufstellung mit aufgenommen wird – Default `true`, muss synchron zu
 * frontend/src/constants/fieldConfig.js gehalten werden. `createBoard`
 * ruft explizit mit `includeAway: false`.
 */
export function buildDefaultPlayers(fieldType, { includeAway = true } = {}) {
  const positions = DEFAULT_POSITIONS_BY_FIELD[fieldType] ?? DEFAULT_POSITIONS_BY_FIELD.large;
  const home = (positions.home ?? []).map((p) => ({ ...p, team: 'home' }));
  const away = includeAway ? (positions.away ?? []).map((p) => ({ ...p, team: 'away' })) : [];
  // ROADMAP-Backlog "beweglicher Ball": Eintrag im selben players-Array
  // statt eigenem Datenmodell – siehe ensureBall() im Frontend-Pendant
  // (frontend/src/constants/fieldConfig.js), MUSS synchron gehalten werden.
  const dims = FIELD_DIMENSIONS[fieldType] ?? FIELD_DIMENSIONS.large;
  const ball = { id: 'ball', team: 'ball', role: null, x: dims.width / 2, y: dims.height / 2 };
  return [...home, ...away, ball];
}
