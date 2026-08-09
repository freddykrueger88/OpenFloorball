/**
 * PlayerToken – Ein einzelner Spieler auf dem Konva-Canvas
 *
 * Props:
 *   player       – { id, role, team, x, y, name? }
 *   scale        – px pro Meter
 *   offsetX/Y    – Feldversatz in px
 *   color        – Hex-Farbe des Teams
 *   strokeColor  – Rand-Farbe
 *   isSelected   – boolean
 *   isDragging   – boolean
 *   onSelect     – (id) => void
 *   onDragEnd    – (id, newX_m, newY_m) => void
 *   snapToGrid   – Raster-Schrittgröße in Metern (0 = kein Snapping)
 *   readonly     – boolean
 *   showName     – boolean – Spielername ein-/ausblenden (Issue #29)
 *   namePosition – 'oben' | 'unten' – Position des Namens relativ zum Token
 */
import { useRef, useState } from 'react';
import { Circle, Group, Text, Ring, Rect, RegularPolygon } from 'react-konva';
import { useTranslation } from 'react-i18next';
import { POSITION_HINTS } from '../../constants/positionHints.js';

// Token-Größe relativ zur Spielfeldbreite (konstant egal wie groß der Canvas)
const TOKEN_RADIUS_M = 0.75; // Meter
const LABEL_FONT_RATIO = 0.9; // Schriftgröße relativ zum Radius in px
const NAME_MAX_CHARS = 8;

function truncateName(name) {
  if (!name) return '';
  return name.length > NAME_MAX_CHARS ? `${name.slice(0, NAME_MAX_CHARS - 1)}…` : name;
}

export default function PlayerToken({
  player,
  scale,
  offsetX,
  offsetY,
  color        = '#1d4ed8',
  strokeColor  = '#1e3a8a',
  isSelected   = false,
  onSelect,
  onDragEnd,
  snapToGrid   = 0,
  readonly     = false,
  showName     = false,
  namePosition = 'unten',
  showHints    = false, // Positions-Hinweis-Tooltip bei Hover (Issue #27)
}) {
  const groupRef = useRef(null);
  const radius   = Math.max(12, TOKEN_RADIUS_M * scale);
  const fontSize = Math.max(8, radius * LABEL_FONT_RATIO);
  // Form-/Muster-Unterscheidung für Farbblindheit statt nur Farbe (Issue #19):
  // Torwart als Raute statt Kreis, Auswärtsteam mit gestricheltem statt
  // durchgezogenem Rand.
  const isGoalkeeper = player.role === 'TW';
  const strokeDash = player.team === 'away' ? [6, 3] : undefined;
  const [hovered, setHovered] = useState(false);
  const { i18n } = useTranslation();
  const hintLang  = i18n.language?.startsWith('en') ? 'en' : 'de';
  const hintTable = POSITION_HINTS[hintLang] ?? POSITION_HINTS.de;
  const hintInfo  = hintTable[player.role] ?? hintTable['C'];

  // Meter → px
  const toCanvasX = (m) => offsetX + m * scale;
  const toCanvasY = (m) => offsetY + m * scale;

  // px → Meter (mit optionalem Snapping)
  const toMeters = (px, offset) => {
    const m = (px - offset) / scale;
    if (snapToGrid > 0) return Math.round(m / snapToGrid) * snapToGrid;
    return m;
  };

  const handleDragEnd = (e) => {
    if (readonly || !onDragEnd) return;
    const node = e.target;
    const newX = toMeters(node.x(), offsetX);
    const newY = toMeters(node.y(), offsetY);
    // Sicherstellen dass Spieler auf dem Feld bleibt (wird im Hook geclampt)
    onDragEnd(player.id, newX, newY);
  };

  // Name-Label vorbereiten (Issue #29): kein Name → kein Label
  const displayName = showName ? truncateName(player.name) : '';
  const nameFontSize = Math.max(10, radius * 0.55);
  const nameChipW = Math.max(radius * 1.9, displayName.length * nameFontSize * 0.62 + 10);
  const nameChipH = nameFontSize + 6;
  const nameGap = 4;
  const nameY = namePosition === 'oben'
    ? -radius - nameGap - nameChipH
    : radius + nameGap;

  return (
    <Group
      ref={groupRef}
      x={toCanvasX(player.x)}
      y={toCanvasY(player.y)}
      draggable={!readonly}
      onDragStart={() => setHovered(false)}
      onDragEnd={handleDragEnd}
      onClick={() => onSelect?.(player.id)}
      onTap={() => onSelect?.(player.id)}
      onMouseEnter={(e) => { setHovered(true); e.target.getStage().container().style.cursor = readonly ? 'default' : 'grab'; }}
      onMouseLeave={(e) => { setHovered(false); e.target.getStage().container().style.cursor = 'default'; }}
      // Accessibility
      id={`player-${player.id}`}
    >
      {/* Auswahl-Ring */}
      {isSelected && (
        <Ring
          innerRadius={radius + 2}
          outerRadius={radius + 6}
          fill="#facc15"
          opacity={0.9}
        />
      )}

      {/* Schatten-Kreis (Tiefeneffekt) */}
      <Circle
        radius={radius}
        fill="#000"
        opacity={0.25}
        offsetX={-2}
        offsetY={2}
      />

      {/* Haupt-Form: Torwart als Raute, Feldspieler als Kreis */}
      {isGoalkeeper ? (
        <RegularPolygon
          sides={4}
          radius={radius}
          rotation={45}
          fill={color}
          stroke={isSelected ? '#facc15' : strokeColor}
          strokeWidth={isSelected ? 3 : 2}
          dash={strokeDash}
          shadowColor="#000"
          shadowBlur={isSelected ? 12 : 4}
          shadowOpacity={isSelected ? 0.5 : 0.2}
        />
      ) : (
        <Circle
          radius={radius}
          fill={color}
          stroke={isSelected ? '#facc15' : strokeColor}
          strokeWidth={isSelected ? 3 : 2}
          dash={strokeDash}
          shadowColor="#000"
          shadowBlur={isSelected ? 12 : 4}
          shadowOpacity={isSelected ? 0.5 : 0.2}
        />
      )}

      {/* Positions-Label */}
      <Text
        text={player.role}
        fontSize={fontSize}
        fontFamily="Inter, system-ui, sans-serif"
        fontStyle="bold"
        fill="#ffffff"
        align="center"
        verticalAlign="middle"
        width={radius * 2}
        height={radius * 2}
        offsetX={radius}
        offsetY={radius}
        listening={false}
      />

      {/* Spielername (Issue #29) – nur wenn vorhanden & sichtbar geschaltet */}
      {displayName && (
        <Group x={-nameChipW / 2} y={nameY} listening={false}>
          <Rect
            width={nameChipW}
            height={nameChipH}
            cornerRadius={nameChipH / 2}
            fill="rgba(15, 17, 23, 0.72)"
            stroke="rgba(255, 255, 255, 0.15)"
            strokeWidth={1}
          />
          <Text
            text={displayName}
            fontSize={nameFontSize}
            fontFamily="Inter, system-ui, sans-serif"
            fontStyle="600"
            fill="#ffffff"
            align="center"
            verticalAlign="middle"
            width={nameChipW}
            height={nameChipH}
          />
        </Group>
      )}

      {/* Positions-Hinweis-Tooltip bei Hover (Issue #27) */}
      {showHints && hovered && (
        <Group x={-80} y={-radius - 92} listening={false}>
          <Rect
            width={160}
            height={80}
            cornerRadius={8}
            fill="rgba(15, 17, 23, 0.94)"
            stroke="rgba(255, 255, 255, 0.15)"
            strokeWidth={1}
            shadowColor="#000"
            shadowBlur={10}
            shadowOpacity={0.4}
          />
          <Text
            text={hintInfo.name}
            x={8} y={7}
            width={144}
            fontSize={13}
            fontStyle="700"
            fill="#facc15"
            fontFamily="Inter, system-ui, sans-serif"
          />
          <Text
            text={hintInfo.hint}
            x={8} y={25}
            width={144}
            height={48}
            fontSize={11}
            lineHeight={1.3}
            fill="#ffffff"
            fontFamily="Inter, system-ui, sans-serif"
            wrap="word"
          />
        </Group>
      )}
    </Group>
  );
}
