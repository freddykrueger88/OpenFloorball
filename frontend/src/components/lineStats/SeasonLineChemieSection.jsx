/**
 * SeasonLineChemieSection – Line-Chemie über die gesamte Saison
 * (Statistik-Architektur Phase 8, Advanced Analytics). Dieselbe
 * Formel/Komponente-Optik wie LineStatsSection.jsx (ein Spiel), nur
 * über calculateLineStats aggregiert über ALLE Spiele des Nutzers
 * (siehe matchLinesController.getSeasonLineStats) – bewusst dasselbe
 * CSS-Modul wiederverwendet, es ist bereits vollständig generisch.
 *
 * `now` wird beim Aufruf bewusst nicht gesetzt (siehe Backend-
 * Kommentar) – eine offene Zeile aus einem laufenden Spiel bleibt hier
 * unberücksichtigt, "unbekannt ≠ 0" statt eines vom Abrufzeitpunkt
 * abhängigen, nicht reproduzierbaren Werts.
 */
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { useSeasonLineStats } from '../../hooks/useSeasonLineStats.js';
import styles from './LineStatsSection.module.css';

function formatDuration(seconds) {
  const m = String(Math.floor(seconds / 60)).padStart(2, '0');
  const s = String(Math.floor(seconds % 60)).padStart(2, '0');
  return `${m}:${s}`;
}

export default function SeasonLineChemieSection() {
  const { t } = useTranslation();
  const { seasonLineStats, loading, error, fetchSeasonLineStats } = useSeasonLineStats();

  useEffect(() => { fetchSeasonLineStats().catch(() => {}); }, [fetchSeasonLineStats]);

  if (!loading && seasonLineStats.length === 0) return null;

  // Absteigend nach Tordifferenz – die interessanteste erste Frage bei
  // "Chemie" ist "welche Line performt am besten", nicht alphabetisch.
  const sorted = [...seasonLineStats].sort(
    (a, b) => (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst)
  );

  return (
    <section className={styles.panel} aria-label={t('lineStats.seasonAriaLabel')}>
      <h3 className={styles.heading}>{t('lineStats.seasonTitle')}</h3>

      {error && <p className={styles.msgError}><AlertTriangle size={16} aria-hidden="true" /> {error}</p>}

      <ul className={styles.list} role="list">
        {sorted.map((line) => (
          <li key={line.lineId ?? line.lineName} className={styles.item}>
            <span className={styles.name}>{line.lineName}</span>
            <span className={styles.time}>
              {line.totalSeconds === null
                ? t('lineStats.timeUnknown')
                : formatDuration(line.totalSeconds)}
            </span>
            <span className={styles.goals}>{line.goalsFor} : {line.goalsAgainst}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
