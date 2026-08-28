/**
 * DrawingLayer – Konva Layer für alle Zeichen-Elemente
 * Hört auf Pointer-Events vom Stage und leitet sie an useDrawing weiter
 */
import { Layer, Rect } from 'react-konva';
import DrawingElement from './DrawingElement.jsx';

export default function DrawingLayer({
  elements      = [],
  scale,
  offsetX,
  offsetY,
  fieldW,
  fieldH,
  selectedId    = null,
  activeTool,
  isDrawing,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onElementClick,
  readonly      = false,
  // Layer-System (CLAUDE.md §10.2): { move, pass, shot, freehand, zone } –
  // fehlend/undefined gilt als sichtbar, siehe PlayerLayer.jsx.
  layerVisibility,
}) {
  // 'comment' erzeugt zwar kein Frame-Element (siehe drawingConfig.js),
  // braucht das unsichtbare Hit-Rect aber trotzdem – ein Klick soll die
  // Feld-Position liefern, BoardEditorPage.jsx fängt ihn dann VOR
  // useDrawing.handlePointerDown ab und öffnet den Anpinnen-Dialog statt
  // ein Element anzulegen.
  const isDrawingTool = !['select', 'eraser'].includes(activeTool);
  const visibleElements = elements.filter((el) => layerVisibility?.[el.type] !== false);

  // Canvas-px → Meter
  const toMeterX = (px) => (px - offsetX) / scale;
  const toMeterY = (py) => (py - offsetY) / scale;

  const getPos = (e) => {
    const stage = e.target.getStage();
    const pos   = stage.getPointerPosition();
    return { x: toMeterX(pos.x), y: toMeterY(pos.y) };
  };

  return (
    <Layer>
      {/* Unsichtbares Rect für Pointer-Events auf dem Spielfeld */}
      {!readonly && isDrawingTool && (
        <Rect
          x={offsetX} y={offsetY}
          width={fieldW} height={fieldH}
          fill="transparent"
          onMouseDown={(e) => { const p = getPos(e); onPointerDown(p.x, p.y); }}
          onMouseMove={(e) => { if (isDrawing) { const p = getPos(e); onPointerMove(p.x, p.y); } }}
          onMouseUp={onPointerUp}
          onTouchStart={(e) => { const p = getPos(e); onPointerDown(p.x, p.y); }}
          onTouchMove={(e)  => { if (isDrawing) { const p = getPos(e); onPointerMove(p.x, p.y); } }}
          onTouchEnd={onPointerUp}
        />
      )}

      {/* Alle Zeichen-Elemente, nach Layer-Sichtbarkeit gefiltert */}
      {visibleElements.map((el) => (
        <DrawingElement
          key={el.id}
          element={el}
          scale={scale}
          offsetX={offsetX}
          offsetY={offsetY}
          isSelected={el.id === selectedId}
          onClick={readonly ? undefined : onElementClick}
        />
      ))}
    </Layer>
  );
}
