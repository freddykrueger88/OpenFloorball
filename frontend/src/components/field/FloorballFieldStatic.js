/**
 * FloorballFieldStatic – Offscreen-Rendering via Konva für GIF-Export
 * Issue #15 – v0.5.0
 *
 * Erstellt eine unsichtbare Konva-Stage, rendert alle Layer und gibt
 * einen PNG-DataURL-String zurück (Promise<string>).
 *
 * HINWEIS: Läuft nur im Browser (window.document muss verfügbar sein).
 */
import Konva from 'konva';
import { IFF_FIELDS } from '../../constants/fieldConfig.js';
import { FIELD_COLORS } from '../../constants/fieldTheme.js';
import { computeAngleTriangle, computeReboundZone, getKeeperClearancePoint } from '../../utils/angleMath.js';
import { normalizeElementShape } from '../../utils/elementShape.js';

const BALL_RADIUS_M = 0.115;
const FACEOFF_INSET_M = 1.5; // IFF: Anspiel-Punkte 1,5m von den Langseiten entfernt

function computeScale(field, w, h, padding = 40) {
  const scale  = Math.min((w - padding * 2) / field.width, (h - padding * 2) / field.height);
  const fieldW = field.width  * scale;
  const fieldH = field.height * scale;
  return { scale, fieldW, fieldH, offsetX: (w - fieldW) / 2, offsetY: (h - fieldH) / 2 };
}

export default async function renderFieldFrame({
  fieldType = 'large',
  width     = 1280,
  height    = 720,
  theme     = 'dark',
  players   = [],
  elements  = [],
  homeColor = { fill: '#1d4ed8', stroke: '#1e3a8a' },
  awayColor = { fill: '#dc2626', stroke: '#991b1b' },
  ballColor = '#f97316',
}) {
  const field  = IFF_FIELDS[fieldType] ?? IFF_FIELDS.large;
  const colors = FIELD_COLORS[theme]   ?? FIELD_COLORS.dark;
  const { scale, fieldW, fieldH, offsetX: ox, offsetY: oy } = computeScale(field, width, height);
  const cx = ox + fieldW / 2;
  const cy = oy + fieldH / 2;

  const px = (m) => m * scale;
  const lw = Math.max(1, scale * 0.05);
  const lw2 = lw * 2;
  const goalAreaW = px(field.goalAreaWidth);
  const goalAreaD = px(field.goalAreaDepth);
  const keeperW   = px(field.keeperWidth);
  const keeperD   = px(field.keeperDepth);
  // Torraum + Torwartfläche sind laut IFF-Regelwerk schmal-lang – rein
  // optisch für die Darstellung kompakter gekappt UND insgesamt
  // verkleinert (×0.65). Tiefe (x) bleibt kleiner als Breite (y) –
  // "quadratischer" Eindruck soll von oben nach unten entstehen.
  const AREA_SCALE = 0.65;
  const goalAreaDisplayW = goalAreaW * AREA_SCALE;
  const goalAreaDisplayD = Math.min(goalAreaD, goalAreaW * 0.8) * AREA_SCALE;
  const keeperDisplayW = keeperW * AREA_SCALE;
  const keeperDisplayD = Math.min(keeperD, keeperW * 0.8) * AREA_SCALE;
  const goalW_px  = px(field.goalWidth);
  const goalD_px  = px(field.goalDepth);
  const goalInset = px(field.goalLineInset);
  const ballR     = Math.max(4, px(BALL_RADIUS_M));

  // Unsichtbarer Container-Div
  const container = document.createElement('div');
  container.style.cssText = 'position:absolute;top:-9999px;left:-9999px;visibility:hidden;';
  document.body.appendChild(container);

  const stage = new Konva.Stage({ container, width, height });
  const layer = new Konva.Layer();
  stage.add(layer);

  // ── Spielfeld ──
  layer.add(new Konva.Rect({
    x: ox, y: oy, width: fieldW, height: fieldH,
    fill: colors.surface, cornerRadius: px(field.cornerRadius),
    stroke: colors.board, strokeWidth: lw2 * 2,
    shadowColor: '#000', shadowBlur: 12, shadowOpacity: 0.3,
  }));

  // Torraum (4×5m) + Torwartfläche (1×2,5m) + Tor – beginnen goalInset
  // (2,85m Großfeld) von der Bande entfernt, sodass der Raum "hinter dem
  // Tor" bespielbar bleibt (anders als beim Fußball)
  for (const side of ['left', 'right']) {
    const gx = side === 'left' ? ox + goalInset : ox + fieldW - goalInset - goalAreaDisplayD;
    layer.add(new Konva.Rect({ x: gx, y: cy - goalAreaDisplayW / 2, width: goalAreaDisplayD, height: goalAreaDisplayW, fill: colors.goalArea, stroke: colors.line, strokeWidth: lw }));
    if (keeperD > 0) {
      const kx = side === 'left' ? ox + goalInset : ox + fieldW - goalInset - keeperDisplayD;
      layer.add(new Konva.Rect({ x: kx, y: cy - keeperDisplayW / 2, width: keeperDisplayD, height: keeperDisplayW, fill: colors.keeperArea, stroke: colors.line, strokeWidth: lw }));
    }
    const goalX = side === 'left' ? ox + goalInset - goalD_px : ox + fieldW - goalInset;
    layer.add(new Konva.Rect({ x: goalX, y: cy - goalW_px / 2, width: goalD_px, height: goalW_px, fill: 'transparent', stroke: colors.goal, strokeWidth: lw2 }));
  }

  // Mittellinie + Anspiel-Punkte (IFF: Mittelpunkt + 6 weitere Punkte auf
  // Mittellinie/Torlinien-Verlängerungen, je 1,5m von den Langseiten)
  layer.add(new Konva.Line({ points: [cx, oy, cx, oy + fieldH], stroke: colors.line, strokeWidth: lw }));
  layer.add(new Konva.Circle({ x: cx, y: cy, radius: lw * 2.5, fill: colors.line }));
  const faceoffNearY = oy + px(FACEOFF_INSET_M);
  const faceoffFarY  = oy + fieldH - px(FACEOFF_INSET_M);
  for (const d of [
    { x: cx,          y: faceoffNearY },
    { x: cx,          y: faceoffFarY  },
    { x: ox,          y: faceoffNearY },
    { x: ox,          y: faceoffFarY  },
    { x: ox + fieldW, y: faceoffNearY },
    { x: ox + fieldW, y: faceoffFarY  },
  ]) {
    layer.add(new Konva.Circle({ x: d.x, y: d.y, radius: lw * 2.5, fill: colors.line }));
  }

  // Spieler + Ball (ROADMAP-Backlog "beweglicher Ball": der Ball ist ein
  // Eintrag mit team:'ball' im selben players-Array, siehe ensureBall() in
  // constants/fieldConfig.js – kein fixer Mittelpunkt mehr, sondern die
  // tatsächliche Position aus dem jeweiligen Frame)
  for (const p of players) {
    const px_ = ox + p.x * scale;
    const py_ = oy + p.y * scale;
    if (p.team === 'ball') {
      layer.add(new Konva.Circle({ x: px_, y: py_, radius: ballR, fill: ballColor, stroke: 'rgba(0,0,0,0.4)', strokeWidth: Math.max(1, lw * 0.8) }));
      continue;
    }
    // Parität zur Live-Darstellung (PlayerToken.jsx): Torwart als Raute
    // statt Kreis, Auswärts mit gestricheltem Rand, Rollen-Label zentriert,
    // optionaler Namens-Chip oberhalb.
    const r   = Math.max(8, scale * 0.45);
    const col = p.team === 'home' ? homeColor : awayColor;
    const isGoalkeeper = p.role === 'TW';
    const strokeDash = p.team === 'away' ? [6, 3] : undefined;
    const strokeFor = (w) => Math.max(1.5, w);
    if (isGoalkeeper) {
      layer.add(new Konva.RegularPolygon({
        x: px_, y: py_, sides: 4, radius: r, rotation: 45,
        fill: col.fill, stroke: col.stroke ?? col.fill, strokeWidth: strokeFor(lw),
        dash: strokeDash, shadowColor: '#000', shadowBlur: 4, shadowOpacity: 0.2,
      }));
    } else {
      layer.add(new Konva.Circle({
        x: px_, y: py_, radius: r,
        fill: col.fill, stroke: col.stroke ?? col.fill, strokeWidth: strokeFor(lw),
        dash: strokeDash, shadowColor: '#000', shadowBlur: 4, shadowOpacity: 0.2,
      }));
    }
    const label = p.role ?? (p.number !== undefined ? String(p.number) : null);
    if (label) {
      layer.add(new Konva.Text({
        x: px_ - r, y: py_ - r, width: r * 2, height: r * 2,
        text: label, align: 'center', verticalAlign: 'middle',
        fontSize: Math.max(8, r * 0.9), fill: '#fff',
        fontFamily: 'Inter, system-ui, sans-serif', fontStyle: 'bold',
      }));
    }
    if (p.name) {
      const displayName = p.name.length > 8 ? `${p.name.slice(0, 7)}…` : p.name;
      const nameFs = Math.max(10, r * 0.55);
      const chipW = Math.max(r * 1.9, displayName.length * nameFs * 0.62 + 10);
      const chipH = nameFs + 6;
      const chipY = py_ - r - 4 - chipH;
      layer.add(new Konva.Rect({ x: px_ - chipW / 2, y: chipY, width: chipW, height: chipH, cornerRadius: chipH / 2, fill: 'rgba(15,17,23,0.72)', stroke: 'rgba(255,255,255,0.15)', strokeWidth: 1 }));
      layer.add(new Konva.Text({ x: px_ - chipW / 2, y: chipY, width: chipW, height: chipH, text: displayName, fontSize: nameFs, fontFamily: 'Inter, system-ui, sans-serif', fontStyle: '600', fill: '#fff', align: 'center', verticalAlign: 'middle' }));
    }
  }

  // Zeichnungs-Elemente – alle Board- und Legacy-Video-Typen in Parität zur
  // Live-Darstellung (DrawingElement.jsx): die tor-verankerten Torhüter-
  // Werkzeuge (winkel/rebound/konter) über angleMath.js, alles andere über
  // normalizeElementShape (Pfeile, Zone, Freehand, Legacy line/arrow).
  for (const el of elements) {
    if (el.type === 'winkel') {
      const { points } = computeAngleTriangle(field, el.goalSide ?? 'auto', el.x1, el.y1);
      const pts = points.flatMap(([x, y]) => [ox + x * scale, oy + y * scale]);
      layer.add(new Konva.Line({
        points: pts, closed: true,
        fill: el.color ?? '#facc15', stroke: el.color ?? '#facc15',
        strokeWidth: Math.max(1.5, (el.strokeWidth ?? 2) * scale * 0.3),
        lineJoin: 'round', opacity: el.fillOpacity ?? 0.3,
      }));
      continue;
    }

    if (el.type === 'rebound') {
      const { points } = computeReboundZone(field, el.goalSide ?? 'auto', el.x2, el.y2);
      const pts = points.flatMap(([x, y]) => [ox + x * scale, oy + y * scale]);
      layer.add(new Konva.Line({
        points: pts, closed: true,
        fill: el.color ?? '#f97316', stroke: el.color ?? '#f97316',
        strokeWidth: Math.max(1.5, (el.strokeWidth ?? 2) * scale * 0.3),
        lineJoin: 'round', opacity: el.fillOpacity ?? 0.2,
      }));
      continue;
    }

    if (el.type === 'konter') {
      // Konter-Pfeil + kleine Torwart-Raute am Anker – Parität mit der
      // Live-Darstellung (DrawingElement.jsx).
      const anchor = getKeeperClearancePoint(field, el.goalSide ?? 'auto');
      const pts = [ox + anchor.x * scale, oy + anchor.y * scale, ox + el.x2 * scale, oy + el.y2 * scale];
      const sw = Math.max(1.5, (el.strokeWidth ?? 5) * scale * 0.3);
      layer.add(new Konva.RegularPolygon({
        x: ox + anchor.x * scale, y: oy + anchor.y * scale,
        sides: 4, radius: Math.max(7, scale * 0.4), rotation: 45,
        fill: el.color ?? '#facc15', stroke: el.color ?? '#facc15',
        strokeWidth: Math.max(1.5, 2 * scale * 0.3), opacity: 0.9,
      }));
      layer.add(new Konva.Arrow({
        points: pts,
        stroke: el.color ?? '#facc15', fill: el.color ?? '#facc15',
        strokeWidth: sw, dash: el.dash ?? [14, 8], lineCap: 'round', lineJoin: 'round',
        pointerLength: el.arrowHead ? Math.max(14, sw * 4) : 0,
        pointerWidth:  el.arrowHead ? Math.max(12, sw * 3) : 0,
      }));
      continue;
    }

    if (el.type === 'komm') {
      // Torwart-Kommunikation: Blase mit eingebranntem Phrasentext am
      // Anspielpunkt + gestrichelter Connector zum Torwart – Parität mit
      // der Live-Darstellung (DrawingElement.jsx).
      const anchor = getKeeperClearancePoint(field, el.goalSide ?? 'auto');
      const ax = ox + anchor.x * scale, ay = oy + anchor.y * scale;
      const bx = ox + el.x2 * scale, by = oy + el.y2 * scale;
      const bw = 220, bh = 60, pad = 12;
      const dotR = Math.max(4, scale * 0.18);
      layer.add(new Konva.Circle({ x: ax, y: ay, radius: dotR, fill: el.color ?? '#facc15', stroke: el.color ?? '#facc15', strokeWidth: 2, opacity: 0.9 }));
      layer.add(new Konva.Line({ points: [ax, ay, bx, by], stroke: el.color ?? '#facc15', strokeWidth: Math.max(1.5, (el.strokeWidth ?? 2) * scale * 0.3), dash: el.dash ?? [4, 2], opacity: 0.5 }));
      layer.add(new Konva.Rect({ x: bx - bw / 2, y: by - bh / 2, width: bw, height: bh, cornerRadius: bh / 2, fill: 'rgba(15,17,23,0.85)', stroke: el.color ?? '#facc15', strokeWidth: 2 }));
      if (el.text) {
        layer.add(new Konva.Text({ x: bx - bw / 2 + pad, y: by - bh / 2, width: bw - pad * 2, height: bh, text: el.text, verticalAlign: 'middle', align: 'center', wrap: 'word', fontSize: 15, fontStyle: '700', fill: '#fff', fontFamily: 'Inter, system-ui, sans-serif' }));
      }
      continue;
    }

    const shape = normalizeElementShape(el);
    if (!shape) continue;
    const sw = Math.max(1.5, shape.strokeWidth * scale * 0.3);
    const pts = shape.points.map(([x, y]) => [ox + x * scale, oy + y * scale]).flat();

    if (shape.kind === 'arrow') {
      const pointerLength = Math.max(12, sw * 4);
      const pointerWidth  = Math.max(10, sw * 3);
      layer.add(new Konva.Arrow({
        points: pts, stroke: shape.color, strokeWidth: sw, fill: shape.color,
        dash: shape.dash, lineCap: 'round', lineJoin: 'round',
        pointerLength: shape.arrowHead ? pointerLength : 0,
        pointerWidth:  shape.arrowHead ? pointerWidth  : 0,
      }));
    } else if (shape.kind === 'line') {
      layer.add(new Konva.Line({ points: pts, stroke: shape.color, strokeWidth: sw, dash: shape.dash, lineCap: 'round', lineJoin: 'round' }));
    } else if (shape.kind === 'rect') {
      layer.add(new Konva.Rect({
        x: ox + shape.x * scale, y: oy + shape.y * scale,
        width: shape.w * scale, height: shape.h * scale,
        fill: shape.color, opacity: shape.fillOpacity,
        stroke: shape.color, strokeWidth: sw,
      }));
    } else if (shape.kind === 'polyline') {
      layer.add(new Konva.Line({ points: pts, stroke: shape.color, strokeWidth: sw, dash: shape.dash, tension: shape.tension, lineCap: 'round', lineJoin: 'round' }));
    }
  }

  layer.draw();
  const dataUrl = stage.toDataURL({ mimeType: 'image/png', pixelRatio: 1 });

  // Cleanup
  stage.destroy();
  document.body.removeChild(container);

  return dataUrl;
}
