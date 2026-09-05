/**
 * elementShape – normalisiert ein Zeichen-Element des Taktikboards auf
 * eine für den statischen Export-Renderer (FloorballFieldStatic.js)
 * zeichenbare, reine Form.
 *
 * Hintergrund: Der Board-Editor erzeugt Pfeil-Typen (`move`/`pass`/`shot`),
 * `zone` und `freehand` (plus `winkel`, das über angleMath.js separat
 * läuft). Video-Elemente (VideoAnnotationOverlay → videoElementsToBoard
 * Elements) können zusätzlich als Legacy-`line`/`arrow` mit scalar
 * x1/y1/x2/y2 oder als `freehand`-Polylinie (points-Array) vorliegen.
 * Diese Funktion bringt beide Welten auf ein gemeinsames, testbares
 * Zwischenformat – als Pure Function, damit die Konva-/Canvas-Logik im
 * Renderer schlank bleibt und geometrische Entscheidungen (min/abs bei
 * Zonen, Punkte-Paarung, Dash/Arrowhead-Defaults) isoliert testbar sind.
 *
 * Alle Koordinaten bleiben in Metern; die px-Umrechnung macht der Renderer.
 */

// Liest die Punkte eines Linien-/Pfeil-Elements: bevorzugt scalar
// x1/y1/x2/y2 (Board-Editor), fällt auf ein points-Array zurück (ältere
// Video-Elemente), sonst null.
function linePointsOf(el) {
  if (typeof el.x1 === 'number' || typeof el.x2 === 'number') {
    return [[el.x1, el.y1], [el.x2, el.y2]];
  }
  const raw = el.points ?? [];
  const points = [];
  for (let i = 0; i + 1 < raw.length; i += 2) points.push([raw[i], raw[i + 1]]);
  return points.length >= 2 ? points : null;
}

export function normalizeElementShape(el) {
  if (!el || typeof el.type !== 'string') return null;

  const strokeWidth = el.strokeWidth ?? 2;
  const color = el.color;
  const dash = el.dash ?? [];

  switch (el.type) {
    case 'move':
    case 'pass':
    case 'shot':
    case 'arrow': // Legacy-Video-Pfeil (scalar oder points-Array)
    case 'line': { // Legacy-Video-Linie (scalar oder points-Array)
      const points = linePointsOf(el);
      if (!points) return null;
      return {
        kind: el.type === 'line' ? 'line' : 'arrow',
        points,
        strokeWidth,
        color,
        dash,
        arrowHead: el.type === 'line' ? false : (el.arrowHead ?? false),
      };
    }
    case 'zone':
      return {
        kind: 'rect',
        x: Math.min(el.x1, el.x2),
        y: Math.min(el.y1, el.y2),
        w: Math.abs(el.x2 - el.x1),
        h: Math.abs(el.y2 - el.y1),
        fillOpacity: el.fillOpacity ?? 0.25,
        strokeWidth,
        color,
      };
    case 'freehand': {
      const raw = el.points ?? [];
      const points = [];
      for (let i = 0; i + 1 < raw.length; i += 2) points.push([raw[i], raw[i + 1]]);
      if (points.length < 2) return null;
      return {
        kind: 'polyline',
        points,
        tension: 0.4, // wie die Live-Darstellung (DrawingElement.jsx)
        strokeWidth,
        color,
        dash,
      };
    }
    default:
      return null; // 'winkel' & unbekannte Typen behandelt der Renderer separat
  }
}