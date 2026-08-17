/**
 * PlayerComparisonSection – Spieler-Vergleich (Statistik-Architektur
 * Phase 4). Rein Frontend-Feature, keine neue Backend-Route – nutzt die
 * bereits über useRosterStats geladenen Saison-Kennzahlen. Transponierte
 * Tabelle: Zeilen = Kennzahlen, Spalten = ausgewählte Spieler.
 */
import { useTranslation } from 'react-i18next';
import Button from '../common/Button.jsx';
import styles from './PlayerComparisonSection.module.css';

const METRIC_KEYS = [
  'goals', 'penaltyMinutes', 'matchPenalties', 'appearances',
  'shots', 'shotPercentage', 'goalsAgainst', 'savePercentage',
];

export default function PlayerComparisonSection({ players, onClear }) {
  const { t } = useTranslation();

  if (players.length === 0) return null;

  return (
    <section className={styles.panel} aria-label={t('stats.comparison.title')}>
      <div className={styles.headerRow}>
        <h2 className={styles.heading}>{t('stats.comparison.title')}</h2>
        <Button variant="secondary" size="sm" onClick={onClear}>{t('stats.comparison.clearSelection')}</Button>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t('stats.colName')}</th>
              {players.map((p) => <th key={p._id}>{p.name}</th>)}
            </tr>
          </thead>
          <tbody>
            {METRIC_KEYS.map((key) => (
              <tr key={key}>
                <td>{t(`stats.col${key.charAt(0).toUpperCase()}${key.slice(1)}`)}</td>
                {players.map((p) => <td key={p._id}>{p[key] ?? '–'}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
