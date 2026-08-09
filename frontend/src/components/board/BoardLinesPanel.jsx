/**
 * BoardLinesPanel – Lines (Kader-Spieler-Kombinationen, siehe
 * linesController.js) direkt im Board-Editor zum schnellen Durchwechseln.
 * Anlegen/Bearbeiten/Spieler zuweisen bleibt bewusst auf /lines (Link am
 * Ende) – hier nur "anwenden": trägt die Namen/Nummern der Line-Spieler
 * (nach Rolle sortiert) auf die Heimteam-Positionen des aktuellen Frames
 * ein, analog der bestehenden Kader-Zuweisung auf einzelne Spieler
 * (PlayerInfoPanel.jsx), nur für eine ganze Line auf einmal.
 */
import { useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import Button from '../common/Button.jsx';
import styles from './BoardLinesPanel.module.css';

export default function BoardLinesPanel({ lines = [], onApply }) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <section className={styles.panel} aria-label={t('boardLines.sectionAriaLabel')}>
      <header className={styles.header}>
        <Button
          variant="ghost"
          size="sm"
          className={styles.collapseBtn}
          onClick={() => setCollapsed((v) => !v)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? t('boardLines.expand') : t('boardLines.collapse')}
        >
          <span aria-hidden="true">{collapsed ? '▸' : '▾'}</span> {t('boardLines.title')}
        </Button>
      </header>

      {!collapsed && (
        <>
          {lines.length === 0 ? (
            <p className={styles.emptyHint}>{t('boardLines.emptyHint')}</p>
          ) : (
            <ul className={styles.list} role="list">
              {lines.map((line) => (
                <li key={line._id}>
                  <Button
                    variant={line.isActive ? 'primary' : 'secondary'}
                    size="sm"
                    className={styles.applyBtn}
                    onClick={() => onApply?.(line)}
                    title={t('boardLines.applyTitle')}
                  >
                    <span className={styles.colorDot} style={{ background: line.color }} aria-hidden="true" />
                    <span className={styles.name}>{line.name}</span>
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <Link to="/lines" className={styles.manageLink}>{t('boardLines.manageLink')}</Link>
        </>
      )}
    </section>
  );
}
