/**
 * FieldContainer – responsiver Wrapper für FloorballField
 * Misst die verfügbare Größe via ResizeObserver und übergibt
 * width/height an FloorballField.
 */
import { useRef, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import FloorballField from './FloorballField.jsx';
import styles from './FieldContainer.module.css';

export default function FieldContainer({
  fieldType = 'large',
  showGrid  = false,
  gridSize  = 1.0,
  theme     = 'dark',
  readonly  = false,
  minHeight = 320,
  // Spieler
  players           = [],
  selectedPlayerId  = null,
  onSelectPlayer,
  onDragEndPlayer,
  homeColor,
  awayColor,
  ballColor,
  snapToGrid = 0,
  showNames    = false,
  namePosition = 'unten',
  showHints    = false, // Issue #27
  // Zeichnen
  drawingElements    = [],
  selectedDrawingId  = null,
  activeTool,
  isDrawing,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onElementClick,
  // Echtzeit-Co-Editing (ROADMAP-Backlog)
  cursors,
  onFieldPointerMove,
  onFieldPointerLeave,
  // Layer-System (CLAUDE.md §10.2)
  layerVisibility,
  comments,
  onCommentPinClick,
}) {
  const { t } = useTranslation();
  const containerRef = useRef(null);
  const [size, setSize] = useState({ width: 800, height: 500 });

  const measure = useCallback(() => {
    if (!containerRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    setSize({
      width:  Math.max(300, clientWidth),
      height: Math.max(minHeight, clientHeight),
    });
  }, [minHeight]);

  useEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [measure]);

  return (
    <div
      ref={containerRef}
      className={styles.container}
      style={{ minHeight }}
      role="region"
      aria-label={t('accessibility.fieldCanvas')}
    >
      <FloorballField
        fieldType={fieldType}
        width={size.width}
        height={size.height}
        showGrid={showGrid}
        gridSize={gridSize}
        theme={theme}
        readonly={readonly}
        players={players}
        selectedPlayerId={selectedPlayerId}
        onSelectPlayer={onSelectPlayer}
        onDragEndPlayer={onDragEndPlayer}
        homeColor={homeColor}
        awayColor={awayColor}
        ballColor={ballColor}
        snapToGrid={snapToGrid}
        showNames={showNames}
        namePosition={namePosition}
        showHints={showHints}
        drawingElements={drawingElements}
        selectedDrawingId={selectedDrawingId}
        activeTool={activeTool}
        isDrawing={isDrawing}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onElementClick={onElementClick}
        cursors={cursors}
        onFieldPointerMove={onFieldPointerMove}
        onFieldPointerLeave={onFieldPointerLeave}
        layerVisibility={layerVisibility}
        comments={comments}
        onCommentPinClick={onCommentPinClick}
      />
    </div>
  );
}
