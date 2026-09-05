/**
 * DrawingElement – Rendert ein einzelnes Zeichen-Element auf dem Canvas
 * Unterstützt: move (Pfeil), pass (gestrichelter Pfeil), shot (dicker Pfeil),
 * freehand, zone (Trainingszone, Layer-System CLAUDE.md §10.2),
 * winkel (Torwart-Winkel, CLAUDE.md §9.7), rebound (Rebound-Raum),
 * konter (Konterauslösung), komm (Torwart-Kommunikation)
 */
import { Arrow, Line, Group, Rect, RegularPolygon, Text, Circle } from 'react-konva';
import { computeAngleTriangle, computeReboundZone, getKeeperClearancePoint } from '../../utils/angleMath.js';

export default function DrawingElement({
  element,
  field,
  scale,
  offsetX,
  offsetY,
  isSelected = false,
  onClick,
}) {
  const toX = (m) => offsetX + m * scale;
  const toY = (m) => offsetY + m * scale;

  const selectedGlow = isSelected
    ? { shadowColor: '#facc15', shadowBlur: 12, shadowOpacity: 0.8 }
    : {};

  const clickProps = {
    onClick:  () => onClick?.(element.id),
    onTap:    () => onClick?.(element.id),
    hitStrokeWidth: Math.max(16, (element.strokeWidth ?? 3) + 10),
  };

  if (element.type === 'freehand') {
    // Freihand: Punkte sind in Metern gespeichert → in px umrechnen
    const pts = [];
    for (let i = 0; i < element.points.length; i += 2) {
      pts.push(toX(element.points[i]), toY(element.points[i + 1]));
    }
    return (
      <Line
        points={pts}
        stroke={element.color}
        strokeWidth={element.strokeWidth ?? 2}
        tension={0.4}
        lineCap="round"
        lineJoin="round"
        {...selectedGlow}
        {...clickProps}
      />
    );
  }

  if (element.type === 'zone') {
    // Trainingszone: wie ein Pfeil über x1/y1/x2/y2 definiert, aber als
    // Fläche statt als Linie gerendert – Ecken müssen nicht in
    // Zeichenrichtung (x1,y1 oben-links) liegen, daher min/abs statt
    // direkter Übernahme.
    const x = toX(Math.min(element.x1, element.x2));
    const y = toY(Math.min(element.y1, element.y2));
    const width  = Math.abs(toX(element.x2) - toX(element.x1));
    const height = Math.abs(toY(element.y2) - toY(element.y1));
    return (
      <Rect
        x={x} y={y} width={width} height={height}
        fill={element.color}
        opacity={isSelected ? Math.min(1, (element.fillOpacity ?? 0.25) + 0.25) : (element.fillOpacity ?? 0.25)}
        stroke={element.color}
        strokeWidth={element.strokeWidth ?? 2}
        {...clickProps}
      />
    );
  }

  if (element.type === 'winkel') {
    // Torwart-Winkel: Dreieck von den Torpfosten des gewählten Tores zur
    // Spitze (x1/y1, der Torwart-Standort). Ohne Feld-Konfiguration (z.B.
    // Video-Overlay) gibt es keine Pfostengeometrie → nichts rendern.
    if (!field) return null;
    const { points } = computeAngleTriangle(field, element.goalSide ?? 'auto', element.x1, element.y1);
    const pts = [];
    for (const [x, y] of points) pts.push(toX(x), toY(y));
    return (
      <Group>
        {isSelected && (
          <Line
            points={pts}
            closed
            stroke="#facc15"
            strokeWidth={(element.strokeWidth ?? 2) + 6}
            opacity={0.3}
            listening={false}
          />
        )}
        <Line
          points={pts}
          closed
          fill={element.color}
          stroke={element.color}
          strokeWidth={element.strokeWidth ?? 2}
          lineJoin="round"
          opacity={isSelected ? Math.min(1, (element.fillOpacity ?? 0.3) + 0.2) : (element.fillOpacity ?? 0.3)}
          {...selectedGlow}
          {...clickProps}
        />
      </Group>
    );
  }

  if (element.type === 'rebound') {
    // Rebound-Raum: tor-verankertes Trapez von der Tormaulkante zur
    // gewählten Tiefe (x2/y2 = Tiefen-/Anspielpunkt). Wie beim Winkel
    // braucht die Darstellung die Feldkonfiguration für die
    // Pfostengeometrie → ohne field nichts rendern.
    if (!field) return null;
    const { points } = computeReboundZone(field, element.goalSide ?? 'auto', element.x2, element.y2);
    const pts = [];
    for (const [x, y] of points) pts.push(toX(x), toY(y));
    return (
      <Group>
        {isSelected && (
          <Line
            points={pts}
            closed
            stroke="#facc15"
            strokeWidth={(element.strokeWidth ?? 2) + 6}
            opacity={0.3}
            listening={false}
          />
        )}
        <Line
          points={pts}
          closed
          fill={element.color}
          stroke={element.color}
          strokeWidth={element.strokeWidth ?? 2}
          lineJoin="round"
          opacity={isSelected ? Math.min(1, (element.fillOpacity ?? 0.2) + 0.2) : (element.fillOpacity ?? 0.2)}
          {...selectedGlow}
          {...clickProps}
        />
      </Group>
    );
  }

  if (element.type === 'konter') {
    // Konterauslösung: fetter, gestrichelter Pfeil vom Torwart (Anker =
    // Torlinien-Mitte, s. getKeeperClearancePoint) zum ersten Anspielpunkt
    // (x2/y2). Zusätzlich eine kleine Torwart-Raute am Anker, damit die
    // Auslösung optisch klar als Torwart-Pfeil erkennbar ist und sich von
    // einem normalen Pass unterscheidet.
    if (!field) return null;
    const anchor = getKeeperClearancePoint(field, element.goalSide ?? 'auto');
    const pts = [toX(anchor.x), toY(anchor.y), toX(element.x2), toY(element.y2)];
    const sw = element.strokeWidth ?? 5;
    const pointerLen   = Math.max(14, sw * 4);
    const pointerWidth = Math.max(12, sw * 3);
    return (
      <Group>
        {isSelected && (
          <Line
            points={pts}
            stroke="#facc15"
            strokeWidth={sw + 8}
            opacity={0.3}
            lineCap="round"
            listening={false}
          />
        )}
        <RegularPolygon
          x={toX(anchor.x)} y={toY(anchor.y)}
          sides={4} radius={Math.max(7, scale * 0.4)} rotation={45}
          fill={element.color}
          stroke={element.color}
          strokeWidth={2}
          opacity={0.9}
          listening={false}
        />
        <Arrow
          points={pts}
          stroke={element.color}
          strokeWidth={sw}
          fill={element.color}
          dash={element.dash ?? [14, 8]}
          lineCap="round"
          lineJoin="round"
          pointerLength={element.arrowHead ? pointerLen   : 0}
          pointerWidth ={element.arrowHead ? pointerWidth : 0}
          {...selectedGlow}
          {...clickProps}
        />
      </Group>
    );
  }

  if (element.type === 'komm') {
    // Torwart-Kommunikation: Sprechblase mit Phrasentext am gewählten
    // Anspielpunkt (x2/y2), gestrichelter Connector zurück zum Torwart-
    // Anker und ein kleiner Punkt am Anker. Einzige tor-verankerte Methode
    // mit eigenem Text – Blase in festen Screen-Px (wie Kommentar-Pins),
    // damit die Phrase auf jedem Feldtyp lesbar bleibt.
    if (!field || !element.text) return null;
    const anchor = getKeeperClearancePoint(field, element.goalSide ?? 'auto');
    const ax = toX(anchor.x), ay = toY(anchor.y);
    const bx = toX(element.x2), by = toY(element.y2);
    const bw = 220, bh = 60, pad = 12;
    // Punkt am Anker (Torwart)
    const dotR = Math.max(4, scale * 0.18);
    return (
      <Group>
        {isSelected && (
          <Rect
            x={bx - bw / 2} y={by - bh / 2}
            width={bw} height={bh}
            cornerRadius={bh / 2}
            stroke="#facc15"
            strokeWidth={3}
            opacity={0.9}
            listening={false}
          />
        )}
        <Circle
          x={ax} y={ay} radius={dotR}
          fill={element.color}
          stroke={element.color}
          strokeWidth={2}
          opacity={0.9}
          listening={false}
        />
        <Line
          points={[ax, ay, bx, by]}
          stroke={element.color}
          strokeWidth={Math.max(1.5, (element.strokeWidth ?? 2))}
          dash={element.dash ?? [4, 2]}
          opacity={0.5}
          listening={false}
        />
        <Group x={bx - bw / 2} y={by - bh / 2} {...clickProps}>
          <Rect
            width={bw} height={bh}
            cornerRadius={bh / 2}
            fill="rgba(15, 17, 23, 0.85)"
            stroke={element.color}
            strokeWidth={2}
          />
          <Text
            text={element.text}
            x={pad} y={0} width={bw - pad * 2} height={bh}
            verticalAlign="middle"
            align="center"
            wrap="word"
            fontSize={15}
            fontStyle="700"
            fill="#ffffff"
            fontFamily="Inter, system-ui, sans-serif"
          />
        </Group>
      </Group>
    );
  }

  // Pfeil-Typen: move, pass, shot
  const pts = [toX(element.x1), toY(element.y1), toX(element.x2), toY(element.y2)];
  const sw  = element.strokeWidth ?? 3;
  // Pfeilspitze proportional zur Linienstärke
  const pointerLen    = Math.max(12, sw * 4);
  const pointerWidth  = Math.max(10, sw * 3);

  return (
    <Group>
      {/* Auswahl-Highlight (breitere transparente Linie dahinter) */}
      {isSelected && (
        <Line
          points={pts}
          stroke="#facc15"
          strokeWidth={sw + 8}
          opacity={0.3}
          lineCap="round"
          listening={false}
        />
      )}
      <Arrow
        points={pts}
        stroke={element.color}
        strokeWidth={sw}
        fill={element.color}
        dash={element.dash ?? []}
        lineCap="round"
        lineJoin="round"
        pointerLength={element.arrowHead ? pointerLen   : 0}
        pointerWidth ={element.arrowHead ? pointerWidth : 0}
        {...selectedGlow}
        {...clickProps}
      />
    </Group>
  );
}
