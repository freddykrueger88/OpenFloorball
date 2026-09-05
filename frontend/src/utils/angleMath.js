/**
 * angleMath – Geometrie-Helfer für den Torwart-Winkel (CLAUDE.md §9.7).
 *
 * Der "Winkel" zeigt als gleichschenkliges Dreieck, welchen Anteil der
 * Torbreite eine referenzierte Stelle (z.B. der Standort des Torwarts)
 * abdeckt: Die Grundseite sind die beiden Torpfosten, die Spitze ist der
 * gewählte Punkt. Alle Koordinaten in Metern, Feld-Referenz wie überall:
 * Ursprung (0,0) = obere linke Ecke der Spielfläche, x nach rechts,
 * y nach unten.
 *
 * `goalSide` existiert in drei Ausprägungen: 'left' | 'right' (explizit)
 * und 'auto' (in Richtung des nächstgelegenen Tores auflösen). Erlaubt
 * gespeichert wird nur der explizite Wert – 'auto' ist eine
 * Eingabe-/Anzeige-Kurzform und wird beim Rendern aufgelöst, damit die
 * Auflösung beim Feldtyp-Wechsel (pfostengeometrie skaliert mit) immer
 * zur aktuellen Feldkonfiguration passt.
 */

export function resolveGoalSide(goalSide, x, field) {
  if (goalSide === 'left' || goalSide === 'right') return goalSide;
  return (x ?? 0) < field.width / 2 ? 'left' : 'right';
}

export function getGoalCenter(field, side) {
  const mid = field.height / 2;
  if (side === 'left') return { x: field.goalLineInset, y: mid };
  return { x: field.width - field.goalLineInset, y: mid };
}

export function getGoalPosts(field, side) {
  const c = getGoalCenter(field, side);
  const halfWidth = field.goalWidth / 2;
  return [
    { x: c.x, y: c.y - halfWidth },
    { x: c.x, y: c.y + halfWidth },
  ];
}

export function computeAngleTriangle(field, goalSide, apexX, apexY) {
  const side = resolveGoalSide(goalSide, apexX, field);
  const posts = getGoalPosts(field, side);
  return {
    side,
    points: [
      [posts[0].x, posts[0].y],
      [posts[1].x, posts[1].y],
      [apexX, apexY],
    ],
  };
}

/**
 * Positionierungs-Voreinstellungen (CLAUDE.md §9.7 "Positionierung" +
 * "Verschiebung"): typische Torwart-Standpunkte vor der Torfläche.
 *   - base:       Grundstellung mittig vor dem Tor
 *   - kontraOben: zur oberen Pfostenseite verschoben (schieben)
 *   - kontraUnten: zur unteren Pfostenseite verschoben (schieben)
 * Werte relativ zur Feldkonfiguration (Torabstand, Torbreite, Tiefe der
 * Torfläche), damit sie auf allen Feldtypen glaubwürdig bleiben.
 */
export function getKeeperStancePresets(field, side) {
  const c = getGoalCenter(field, side);
  const forward = side === 'left' ? 1 : -1; // vom Tor ins Feld hinein
  const depth = field.goalAreaDepth * 0.3;
  const lateral = field.goalWidth * 0.8;
  return [
    { id: 'base',        x: c.x + forward * depth,         y: c.y },
    { id: 'kontraOben',  x: c.x + forward * depth * 0.75,  y: c.y - lateral },
    { id: 'kontraUnten', x: c.x + forward * depth * 0.75,  y: c.y + lateral },
  ];
}

/**
 * Auslöse-Punkt für die Konterauslösung (CLAUDE.md §9.7): Der Torwart
 * startet den Konter mit einem schnellen Abwurf/Spiel aus dem Tor heraus –
 * Anker ist daher die Mitte der Torlinie des gewählten Tores (auf Höhe der
 * Pfostenlinie, nicht tiefer im Feld). Konsistent zu getGoalCenter, damit
 * der Pfeil im Export und Live identisch sitzt.
 */
export function getKeeperClearancePoint(field, side) {
  return getGoalCenter(field, side);
}

/**
 * Rebound-Raum (CLAUDE.md §9.7 "Rebounds"): Schattiert als Trapez VOR dem
 * Tor, das die Torlinie als Grundseite nutzt und zur gewählten Tiefe hin
 * breiter wird (Abprall-Kegel) – die klassische Torwart-Lehre vom
 * "Rebound-Kontrollraum", in dem Abpraller entschärft bzw. kontrolliert
 * werden müssen.
 *
 * Der Nutzer gibt nur einen Tiefen-/Zielpunkt (depthX/depthY) an; die
 * Grundseite (Torpfosten) und die Kegelbreite werden aus der aktuellen
 * Feldkonfiguration abgeleitet (skaliert damit beim Feldtyp-Wechsel mit,
 * wie der Torwart-Winkel). Alle Punkte werden ins Spielfeld geclampt.
 *
 * Rückgabe: { side, points: [[x,y], ...] } – 4 Punkte im Uhrzeigersinn
 * (Torlinie oben-links→unten, Kegelkante unten/oben).
 */
export function computeReboundZone(field, goalSide, depthX, depthY) {
  const side = resolveGoalSide(goalSide, depthX, field);
  const c = getGoalCenter(field, side);
  const halfW = field.goalWidth / 2;

  // Grundseite: die Tormaulkante
  const near = [
    { x: c.x, y: c.y - halfW },
    { x: c.x, y: c.y + halfW },
  ];

  // Richtung vom Tor zum gewählten Tiefenpunkt
  const dx = depthX - c.x;
  const dy = depthY - c.y;
  const dist = Math.max(0.1, Math.hypot(dx, dy));
  const ux = dx / dist;
  const uy = dy / dist;

  // Kegel wächst mit der Tiefe: mit jedem Meter vor dem Tor kommt auf
  // beiden Seiten ein Meter Breite dazu (Abpraller verteilen sich
  // keilförmig vor dem Tor).
  const farHalfW = halfW + dist;
  const vx = -uy; // Senkrechte zur Abwurfrichtung
  const vy = ux;
  const far = [
    { x: depthX + vx * farHalfW, y: depthY + vy * farHalfW },
    { x: depthX - vx * farHalfW, y: depthY - vy * farHalfW },
  ];

  const clamp = (p) => [
    Math.min(Math.max(p.x, 0), field.width),
    Math.min(Math.max(p.y, 0), field.height),
  ];

  return {
    side,
    points: [clamp(near[0]), clamp(near[1]), clamp(far[0]), clamp(far[1])],
  };
}