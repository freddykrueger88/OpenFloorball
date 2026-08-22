/**
 * TrainingAttendanceSection – tatsächliche Anwesenheit bei einem Training
 * (Statistik-Architektur Phase 5). Struktur analog MatchSquadSection.jsx
 * (Kader-Widget für ein Spiel), nur mit Trainings-eigenen Status-Werten
 * (präsent/entschuldigt/unentschuldigt/verletzt statt spielt/Ersatz/...).
 */
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Check, Clock, X, RotateCcw } from 'lucide-react';
import { useTrainingAttendance } from '../../hooks/useTrainingAttendance.js';
import Button from '../common/Button.jsx';
import styles from './TrainingAttendanceSection.module.css';

export default function TrainingAttendanceSection({ sessionId }) {
  const { t } = useTranslation();
  const { attendance, loading, error, fetchAttendance, setStatus, clearStatus } = useTrainingAttendance(sessionId);

  useEffect(() => { fetchAttendance().catch(() => {}); }, [fetchAttendance]);

  if (!loading && attendance.length === 0) return null;

  const statusLabel = (status) => {
    if (status === 'present') return t('trainingAttendance.statusPresent');
    if (status === 'excused') return t('trainingAttendance.statusExcused');
    if (status === 'injured') return t('trainingAttendance.statusInjured');
    if (status === 'absent')  return t('trainingAttendance.statusAbsent');
    return t('trainingAttendance.statusNone');
  };

  return (
    <section className={styles.panel} aria-label={t('trainingAttendance.ariaLabel')}>
      <h3 className={styles.heading}>{t('trainingAttendance.title')}</h3>

      {error && <p className={styles.msgError}><AlertTriangle size={16} aria-hidden="true" /> {error}</p>}

      {loading && attendance.length === 0 ? (
        <p className={styles.hint}>{t('trainingAttendance.loading')}</p>
      ) : (
        <ul className={styles.list} role="list">
          {attendance.map((entry) => (
            <li key={entry.rosterPlayerId} className={styles.item}>
              <div className={styles.itemRow}>
                <span className={styles.identity}>
                  {entry.role && <span className={styles.roleBadge}>{entry.role}</span>}
                  <span className={styles.name}>
                    {entry.jerseyNumber != null ? `#${entry.jerseyNumber} ` : ''}{entry.name}
                  </span>
                </span>
                <span className={`${styles.statusChip} ${styles[`status-${entry.status ?? 'none'}`]}`}>
                  {statusLabel(entry.status)}
                </span>
              </div>

              <div className={styles.actions} role="group" aria-label={t('trainingAttendance.setStatusAriaLabel', { name: entry.name })}>
                <Button
                  variant={entry.status === 'present' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setStatus(entry.rosterPlayerId, 'present').catch(() => {})}
                >
                  <Check size={14} aria-hidden="true" /> {t('trainingAttendance.statusPresent')}
                </Button>
                <Button
                  variant={entry.status === 'excused' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setStatus(entry.rosterPlayerId, 'excused').catch(() => {})}
                >
                  <Clock size={14} aria-hidden="true" /> {t('trainingAttendance.statusExcused')}
                </Button>
                <Button
                  variant={entry.status === 'injured' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setStatus(entry.rosterPlayerId, 'injured').catch(() => {})}
                >
                  <AlertTriangle size={14} aria-hidden="true" /> {t('trainingAttendance.statusInjured')}
                </Button>
                <Button
                  variant={entry.status === 'absent' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setStatus(entry.rosterPlayerId, 'absent').catch(() => {})}
                >
                  <X size={14} aria-hidden="true" /> {t('trainingAttendance.statusAbsent')}
                </Button>
                {entry.status && (
                  <Button
                    variant="secondary"
                    size="sm"
                    iconOnly
                    onClick={() => clearStatus(entry.rosterPlayerId).catch(() => {})}
                    aria-label={t('trainingAttendance.clearAriaLabel', { name: entry.name })}
                    title={t('trainingAttendance.clearTitle')}
                  >
                    <RotateCcw size={14} aria-hidden="true" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
