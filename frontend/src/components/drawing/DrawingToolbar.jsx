/**
 * DrawingToolbar – Kompakte Werkzeug-Leiste
 * Platzierung: links neben dem Spielfeld (vertikal)
 */
import { useTranslation } from 'react-i18next';
import { Undo2, Redo2, Trash2, Palette } from 'lucide-react';
import { TOOLS, TOOL_ORDER, DEFAULT_COLORS, STROKE_WIDTHS } from '../../constants/drawingConfig.js';
import HistoryPanel from './HistoryPanel.jsx';
import Button from '../common/Button.jsx';
import styles from './DrawingToolbar.module.css';

export default function DrawingToolbar({
  activeTool,
  setActiveTool,
  activeColor,
  setActiveColor,
  strokeWidth,
  setStrokeWidth,
  onUndo,
  onRedo,
  onClear,
  canUndo = false,
  canRedo = false,
  elementCount = 0,
  undoStack = [],
  redoStack = [],
  onJumpHistory,
  hideTools = [],
}) {
  const { t, i18n } = useTranslation();
  const isDE = !i18n.language?.startsWith('en');
  const visibleTools = TOOL_ORDER.filter((k) => !hideTools.includes(k));

  return (
    <aside
      className={styles.toolbar}
      role="toolbar"
      aria-label={t('drawing.toolbarLabel')}
    >
      {/* ── Tools ── */}
      <div className={styles.group} role="radiogroup" aria-label={t('drawing.toolGroupLabel')}>
        {visibleTools.map((key) => {
          const tool = TOOLS[key];
          const label = isDE ? tool.label : (tool.labelEn ?? tool.label);
          return (
            <button
              key={key}
              role="radio"
              aria-checked={activeTool === key}
              className={`${styles.toolBtn} ${activeTool === key ? styles.active : ''}`}
              onClick={() => setActiveTool(key)}
              title={`${label} [${tool.shortcut}]`}
              aria-label={label}
            >
              <span className={styles.icon} aria-hidden="true">{tool.icon}</span>
              <span className={styles.shortcut}>{tool.shortcut}</span>
            </button>
          );
        })}
      </div>

      <div className={styles.divider} role="separator" />

      {/* ── Farben ── */}
      <div className={styles.group} aria-label={t('drawing.colorGroupLabel')} role="radiogroup">
        {DEFAULT_COLORS.map(({ hex, label, labelEn }) => {
          const colorName = isDE ? label : (labelEn ?? label);
          return (
          <button
            key={hex}
            role="radio"
            aria-checked={activeColor === hex}
            className={`${styles.colorBtn} ${activeColor === hex ? styles.colorActive : ''}`}
            style={{ background: hex }}
            onClick={() => setActiveColor(hex)}
            title={colorName}
            aria-label={t('drawing.colorAriaLabel', { color: colorName })}
          />
          );
        })}
        {/* Custom Color Picker */}
        <label className={styles.colorPickerLabel} title={t('drawing.customColor')}>
          <Palette size={16} aria-hidden="true" />
          <input
            type="color"
            className={styles.colorInput}
            value={activeColor}
            onChange={(e) => setActiveColor(e.target.value)}
            aria-label={t('drawing.customColorPick')}
          />
        </label>
      </div>

      <div className={styles.divider} role="separator" />

      {/* ── Linienstärke ── */}
      <div className={styles.group} aria-label={t('drawing.strokeGroupLabel')} role="radiogroup">
        {STROKE_WIDTHS.map(({ value, label, labelEn }) => {
          const widthName = isDE ? label : (labelEn ?? label);
          return (
          <button
            key={value}
            role="radio"
            aria-checked={strokeWidth === value}
            className={`${styles.strokeBtn} ${strokeWidth === value ? styles.active : ''}`}
            onClick={() => setStrokeWidth(value)}
            title={widthName}
            aria-label={t('drawing.strokeAriaLabel', { width: widthName })}
          >
            <span
              style={{ display: 'block', height: `${Math.min(value * 1.5, 8)}px`, background: 'currentColor', borderRadius: '9999px', width: '24px' }}
              aria-hidden="true"
            />
          </button>
          );
        })}
      </div>

      <div className={styles.divider} role="separator" />

      {/* ── Aktionen ── */}
      <div className={styles.group}>
        <Button
          variant="ghost"
          size="md"
          iconOnly
          onClick={onUndo}
          disabled={!canUndo}
          title={t('drawing.undoTitle')}
          aria-label={t('drawing.undo')}
        ><Undo2 size={18} aria-hidden="true" /></Button>
        <Button
          variant="ghost"
          size="md"
          iconOnly
          onClick={onRedo}
          disabled={!canRedo}
          title={t('drawing.redoTitle')}
          aria-label={t('drawing.redo')}
        ><Redo2 size={18} aria-hidden="true" /></Button>
        <Button
          variant="danger"
          size="md"
          iconOnly
          onClick={onClear}
          disabled={elementCount === 0}
          title={t('drawing.clearAll')}
          aria-label={t('drawing.clearAll')}
        ><Trash2 size={18} aria-hidden="true" /></Button>
        <HistoryPanel undoStack={undoStack} redoStack={redoStack} onJump={onJumpHistory} />
      </div>
    </aside>
  );
}
