/**
 * FloorballField – IFF-konformes 2D Floorball-Spielfeld
 * Spielfeld-Layer + Spieler-Layer + Zeichen-Layer
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Stage, Layer, Rect, Line, Circle, Text } from 'react-konva';
import { IFF_FIELDS } from '../../constants/fieldConfig.js';
import { FIELD_COLORS } from '../../constants/fieldTheme.js';
import PlayerLayer from './PlayerLayer.jsx';
import CursorLayer from './CursorLayer.jsx';
import CommentPinsLayer from './CommentPinsLayer.jsx';
import { DrawingLayer } from '../drawing/index.js';

export { FIELD_COLORS };

const DEFAULT_BALL_COLOR = '#f97316'; // Hot Orange
const FACEOFF_INSET_M = 1.5; // IFF: Anspiel-Punkte 1,5m von den Langseiten entfernt

function computeScale(field, canvasW, canvasH, padding = 40) {
  const scale  = Math.min((canvasW - padding * 2) / field.width, (canvasH - padding * 2) / field.height);
  const fieldW = field.width  * scale;
  const fieldH = field.height * scale;
  return { scale, fieldW, fieldH, offsetX: (canvasW - fieldW) / 2, offsetY: (canvasH - fieldH) / 2 };
}

export default function FloorballField({
  fieldType = 'large',
  width     = 800,
  height    = 500,
  showGrid  = false,
  gridSize  = 1.0,
  theme     = 'dark',
  readonly  = false,
  // Spieler
  players       = [],
  selectedPlayerId = null,
  onSelectPlayer,
  onDragEndPlayer,
  homeColor  = { fill: '#1d4ed8', stroke: '#1e3a8a' },
  awayColor  = { fill: '#dc2626', stroke: '#991b1b' },
  ballColor  = DEFAULT_BALL_COLOR,
  snapToGrid = 0,
  showNames    = false,
  namePosition = 'unten',
  showHints    = false, // Issue #27
  // Zeichnen
  drawingElements  = [],
  selectedDrawingId = null,
  activeTool,
  isDrawing,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onElementClick,
  // Echtzeit-Co-Editing (ROADMAP-Backlog): Live-Cursor anderer Nutzer +
  // eigene Pointer-Position melden. Läuft UNABHÄNGIG vom aktiven Zeichen-
  // Tool/isDrawing (anders als onPointerMove oben, das nur während einer
  // laufenden Zeichen-Geste feuert) – Cursor-Tracking soll immer laufen.
  cursors = {},
  onFieldPointerMove,
  onFieldPointerLeave,
  // Layer-System (CLAUDE.md §10.2)
  layerVisibility,
  comments = [],
  onCommentPinClick,
}) {
  const { t } = useTranslation();
  const field  = IFF_FIELDS[fieldType] ?? IFF_FIELDS.large;
  const colors = FIELD_COLORS[theme]   ?? FIELD_COLORS.dark;
  const { scale, fieldW, fieldH, offsetX, offsetY } = useMemo(
    () => computeScale(field, width, height),
    [field, width, height]
  );

  const px  = (m) => m * scale;
  const ox = offsetX, oy = offsetY, cx = ox + fieldW / 2, cy = oy + fieldH / 2;
  const lw = Math.max(1, scale * 0.05), lw2 = lw * 2;
  const goalAreaW = px(field.goalAreaWidth), goalAreaD = px(field.goalAreaDepth);
  const keeperW = px(field.keeperWidth),     keeperD = px(field.keeperDepth);
  // Torraum + Torwartfläche sind laut IFF-Regelwerk schmal-lang (4×5m
  // bzw. 1×2,5m) – rein optisch für die Darstellung kompakter gekappt
  // UND insgesamt verkleinert (×0.65), damit sie nicht zu dominant vor
  // dem Tor wirken; die echten Maße (goalAreaWidth/-Depth,
  // keeperWidth/-Depth) bleiben unverändert. Die Tiefe (ins Feld, x)
  // bleibt dabei bewusst KLEINER als die Breite (entlang Torlinie, y) –
  // der "quadratische" Eindruck soll von oben nach unten entstehen,
  // nicht in die Tiefe.
  const AREA_SCALE = 0.65;
  const goalAreaDisplayW = goalAreaW * AREA_SCALE;
  const goalAreaDisplayD = Math.min(goalAreaD, goalAreaW * 0.8) * AREA_SCALE;
  const keeperDisplayW = keeperW * AREA_SCALE;
  const keeperDisplayD = Math.min(keeperD, keeperW * 0.8) * AREA_SCALE;
  const goalW_px = px(field.goalWidth),      goalD_px = px(field.goalDepth);
  const goalInset = px(field.goalLineInset);

  // Anspiel-Punkte (IFF-Regelwerk): Mittelpunkt + 6 weitere Punkte auf der
  // Mittellinie und den gedachten Verlängerungen der Torlinien, je 1,5m von
  // den Langseiten entfernt – ersetzt den zuvor fälschlich gezeichneten
  // Mittelkreis (Fußball-Markierung, kein Floorball-Element)
  const faceoffNearY = oy + px(FACEOFF_INSET_M);
  const faceoffFarY  = oy + fieldH - px(FACEOFF_INSET_M);
  const faceoffDots = [
    { x: cx,        y: faceoffNearY },
    { x: cx,        y: faceoffFarY  },
    { x: ox,        y: faceoffNearY },
    { x: ox,        y: faceoffFarY  },
    { x: ox+fieldW, y: faceoffNearY },
    { x: ox+fieldW, y: faceoffFarY  },
  ];

  const gridLines = useMemo(() => {
    if (!showGrid || gridSize <= 0) return [];
    const lines = [];
    for (let m = gridSize; m < field.width;  m += gridSize) { const x = ox + px(m); lines.push(<Line key={`gv${m}`} points={[x, oy, x, oy + fieldH]} stroke={colors.grid} strokeWidth={0.5} dash={[3,4]} listening={false}/>); }
    for (let m = gridSize; m < field.height; m += gridSize) { const y = oy + px(m); lines.push(<Line key={`gh${m}`} points={[ox, y, ox + fieldW, y]} stroke={colors.grid} strokeWidth={0.5} dash={[3,4]} listening={false}/>); }
    return lines;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showGrid, gridSize, field, scale, offsetX, offsetY]);

  const handleFieldPointerMove = (e) => {
    if (!onFieldPointerMove) return;
    const stage = e.target.getStage();
    const pos = stage?.getPointerPosition();
    if (!pos) return;
    onFieldPointerMove((pos.x - ox) / scale, (pos.y - oy) / scale);
  };

  return (
    <Stage
      width={width}
      height={height}
      role="img"
      aria-label={t('field.canvasAriaLabel', { label: field.label, count: players.length })}
      onMouseMove={handleFieldPointerMove}
      onTouchMove={handleFieldPointerMove}
      onMouseLeave={onFieldPointerLeave}
    >
      {/* Layer 1: Spielfeld */}
      <Layer listening={false}>
        <Rect x={ox} y={oy} width={fieldW} height={fieldH} fill={colors.surface} cornerRadius={px(field.cornerRadius)} stroke={colors.board} strokeWidth={lw2*2} shadowColor="#000" shadowBlur={12} shadowOpacity={0.3}/>
        {gridLines}
        {/* Torraum (4×5m, rechteckig) + Torwartfläche (1×2,5m) – beide
            beginnen goalInset (2,85m Großfeld) von der Bande entfernt am
            Tor, nicht an der Bande selbst: dahinter bleibt Raum zum
            Weiterspielen "hinter dem Tor" */}
        <Rect x={ox+goalInset} y={cy-goalAreaDisplayW/2} width={goalAreaDisplayD} height={goalAreaDisplayW} fill={colors.goalArea} stroke={colors.line} strokeWidth={lw}/>
        {keeperD>0 && <Rect x={ox+goalInset} y={cy-keeperDisplayW/2} width={keeperDisplayD} height={keeperDisplayW} fill={colors.keeperArea} stroke={colors.line} strokeWidth={lw}/>}
        <Rect x={ox+fieldW-goalInset-goalAreaDisplayD} y={cy-goalAreaDisplayW/2} width={goalAreaDisplayD} height={goalAreaDisplayW} fill={colors.goalArea} stroke={colors.line} strokeWidth={lw}/>
        {keeperD>0 && <Rect x={ox+fieldW-goalInset-keeperDisplayD} y={cy-keeperDisplayW/2} width={keeperDisplayD} height={keeperDisplayW} fill={colors.keeperArea} stroke={colors.line} strokeWidth={lw}/>}
        <Line points={[cx,oy,cx,oy+fieldH]} stroke={colors.line} strokeWidth={lw}/>
        <Circle x={cx} y={cy} radius={lw*2.5} fill={colors.line}/>
        {faceoffDots.map((d, i) => <Circle key={`fo${i}`} x={d.x} y={d.y} radius={lw*2.5} fill={colors.line} listening={false}/>)}
        {/* Tor liegt innerhalb der Bande am Torraum (nicht davor) – der
            Bereich zwischen Bande und Tor bleibt frei bespielbar */}
        <Rect x={ox+goalInset-goalD_px} y={cy-goalW_px/2} width={goalD_px} height={goalW_px} fill="transparent" stroke={colors.goal} strokeWidth={lw2}/>
        <Rect x={ox+fieldW-goalInset} y={cy-goalW_px/2} width={goalD_px} height={goalW_px} fill="transparent" stroke={colors.goal} strokeWidth={lw2}/>
        <Text x={ox} y={oy-20} width={fieldW} align="center" text={field.label} fontSize={Math.max(10,px(0.6))} fill={colors.text} fontFamily="Inter, system-ui, sans-serif"/>
      </Layer>

      {/* Layer 2: Zeichen-Elemente (unter Spielern) */}
      <DrawingLayer
        elements={drawingElements}
        field={field}
        scale={scale}
        offsetX={ox} offsetY={oy}
        fieldW={fieldW} fieldH={fieldH}
        selectedId={selectedDrawingId}
        activeTool={activeTool}
        isDrawing={isDrawing}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onElementClick={onElementClick}
        readonly={readonly}
        layerVisibility={layerVisibility}
      />

      {/* Layer 3: Spieler (immer oben) */}
      <PlayerLayer
        players={players}
        scale={scale}
        offsetX={ox} offsetY={oy}
        homeColor={homeColor} awayColor={awayColor} ballColor={ballColor}
        selectedId={selectedPlayerId}
        onSelect={onSelectPlayer}
        onDragEnd={onDragEndPlayer}
        snapToGrid={snapToGrid}
        readonly={readonly}
        showNames={showNames}
        namePosition={namePosition}
        showHints={showHints}
        layerVisibility={layerVisibility}
      />

      {/* Layer 4: Kommentar-Pins (Layer-System) */}
      <CommentPinsLayer
        comments={comments}
        scale={scale}
        offsetX={ox} offsetY={oy}
        onPinClick={onCommentPinClick}
        visible={layerVisibility?.comments !== false}
      />

      {/* Layer 5: Live-Cursor anderer Nutzer (immer ganz oben) */}
      <CursorLayer cursors={cursors} scale={scale} offsetX={ox} offsetY={oy} />
    </Stage>
  );
}
