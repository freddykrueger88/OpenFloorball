/**
 * FrameTimeline – Timeline am unteren Rand des Spielfelds
 * Zeigt alle Frames als Mini-Thumbnails, aktiver Frame hervorgehoben
 * Unterstützt Drag & Drop zum Sortieren
 */
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GripVertical, X, Plus, PenLine } from 'lucide-react';
import Button from '../common/Button.jsx';
import styles from './FrameTimeline.module.css';

const MAX_FRAMES = 50;

export default function FrameTimeline({
  frames        = [],
  activeIndex   = 0,
  onSelect,
  onAdd,
  onDelete,
  onReorder,
  loading       = false,
  currentPlayers,
  currentElements,
  copyElementsOnAdd    = false,
  onToggleCopyElements,
}) {
  const { t } = useTranslation();
  const dragItem  = useRef(null);
  const dragOver  = useRef(null);
  const [dragging, setDragging] = useState(false);

  // ── Drag & Drop ──
  const handleDragStart = (index) => {
    dragItem.current = index;
    setDragging(true);
  };

  const handleDragEnter = (index) => {
    dragOver.current = index;
  };

  const handleDragEnd = () => {
    setDragging(false);
    if (dragItem.current === null || dragItem.current === dragOver.current) return;
    const reordered = [...frames];
    const [moved]   = reordered.splice(dragItem.current, 1);
    reordered.splice(dragOver.current, 0, moved);
    dragItem.current  = null;
    dragOver.current  = null;
    onReorder?.(reordered);
  };

  return (
    <div
      className={styles.timeline}
      role="region"
      aria-label={t('frames.timelineAriaLabel')}
    >
      {/* Frames */}
      <ol className={styles.list} role="list">
        {frames.map((frame, idx) => (
          <li
            key={frame._id ?? idx}
            className={`
              ${styles.frameItem}
              ${idx === activeIndex ? styles.active : ''}
              ${dragging && dragItem.current === idx ? styles.dragging : ''}
            `}
            draggable
            onDragStart={() => handleDragStart(idx)}
            onDragEnter={() => handleDragEnter(idx)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => e.preventDefault()}
            role="listitem"
          >
            <button
              className={styles.frameBtn}
              onClick={() => onSelect?.(idx)}
              aria-label={`${t('frames.frameLabel', { number: idx + 1 })}${frame.label ? `: ${frame.label}` : ''}${idx === activeIndex ? ` ${t('frames.active')}` : ''}`}
              aria-pressed={idx === activeIndex}
            >
              {/* Thumbnail Platzhalter – zeigt Frame-Nummer + optionales Label */}
              <span className={styles.thumbNumber}>{idx + 1}</span>
              {frame.label && (
                <span className={styles.thumbLabel}>{frame.label}</span>
              )}
              {/* Drag-Indikator */}
              <span className={styles.dragHandle} aria-hidden="true"><GripVertical size={14} aria-hidden="true" /></span>
            </button>

            {/* Frame löschen (nur wenn mehr als 1 Frame) */}
            {frames.length > 1 && (
              <Button
                variant="danger"
                size="sm"
                iconOnly
                className={styles.deleteBtn}
                onClick={(e) => { e.stopPropagation(); onDelete?.(frame._id); }}
                aria-label={t('frames.deleteFrameAriaLabel', { number: idx + 1 })}
                title={t('frames.deleteFrameTitle')}
              ><X size={14} aria-hidden="true" /></Button>
            )}
          </li>
        ))}
      </ol>

      {/* Neue Frames sind meist eine neue Spielsituation – alte Pfeile/
          Zeichnungen passen dann selten noch. Standard daher AUS
          (Spielerpositionen werden trotzdem immer übernommen, siehe
          BoardEditorPage.handleAddFrame), aber als Schalter verfügbar
          für den Fall, dass eine Zeichnung über mehrere Frames hinweg
          gelten soll (z.B. eine Zonenmarkierung). */}
      <Button
        variant={copyElementsOnAdd ? 'primary' : 'secondary'}
        size="sm"
        iconOnly
        className={styles.copyToggleBtn}
        onClick={() => onToggleCopyElements?.()}
        aria-pressed={copyElementsOnAdd}
        aria-label={copyElementsOnAdd ? t('frames.copyElementsOnAriaLabel') : t('frames.copyElementsOffAriaLabel')}
        title={copyElementsOnAdd ? t('frames.copyElementsOnTitle') : t('frames.copyElementsOffTitle')}
      >
        <PenLine size={14} aria-hidden="true" />
      </Button>

      {/* + Frame Button */}
      <Button
        variant="ghost"
        size="md"
        className={styles.addBtn}
        data-tour="editor-frames"
        onClick={() => onAdd?.(currentPlayers, currentElements)}
        disabled={loading || frames.length >= MAX_FRAMES}
        aria-label={t('frames.addFrameAriaLabel')}
        title={frames.length >= MAX_FRAMES ? t('frames.maxFramesTitle', { max: MAX_FRAMES }) : t('frames.addFrameTitle')}
      >
        <Plus size={16} aria-hidden="true" />
        <span className={styles.addLabel}>{t('frames.addLabel')}</span>
      </Button>

      {/* Frame-Zähler */}
      <span className={styles.counter} aria-live="polite">
        {activeIndex + 1} / {frames.length}
      </span>
    </div>
  );
}
