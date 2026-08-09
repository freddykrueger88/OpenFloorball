/**
 * MatchSquadSection – Match-Kader für ein konkretes Spiel
 * (Roadmap-Audit). Struktur analog RsvpSection.jsx, aber ohne
 * "isMe"-Unterscheidung: der Trainer entscheidet den Status für jeden
 * Kader-Spieler, nicht jeder für sich selbst. Kein Team-Gate wie bei
 * RSVP – ein Match-Kader ist auch für den persönlichen Kader (ohne
 * Team) sinnvoll, siehe matchSquadController.getSquad.
 */
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Check, Users, X, RotateCcw } from 'lucide-react';
import { useMatchSquad } from '../../hooks/useMatchSquad.js';
import Button from '../common/Button.jsx';
import styles from './MatchSquadSection.module.css';

export default function MatchSquadSection({ gameId }) {
  const { t } = useTranslation();
  const { squad, loading, error, fetchSquad, setStatus, clearStatus } = useMatchSquad(gameId);

  useEffect(() => { fetchSquad().catch(() => {}); }, [fetchSquad]);

  if (!loading && squad.length === 0) return null;

  const statusLabel = (status) => {
    if (status === 'playing') return t('matchSquad.statusPlaying');
    if (status === 'reserve') return t('matchSquad.statusReserve');
    if (status === 'injured') return t('matchSquad.statusInjured');
    if (status === 'absent')  return t('matchSquad.statusAbsent');
    return t('matchSquad.statusNone');
  };

  return (
    <section className={styles.panel} aria-label={t('matchSquad.ariaLabel')}>
      <h3 className={styles.heading}>{t('matchSquad.title')}</h3>

      {error && <p className={styles.msgError}><AlertTriangle size={16} aria-hidden="true" /> {error}</p>}

      {loading && squad.length === 0 ? (
        <p className={styles.hint}>{t('matchSquad.loading')}</p>
      ) : (
        <ul className={styles.list} role="list">
          {squad.map((entry) => (
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

              <div className={styles.actions} role="group" aria-label={t('matchSquad.setStatusAriaLabel', { name: entry.name })}>
                <Button
                  variant={entry.status === 'playing' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setStatus(entry.rosterPlayerId, 'playing').catch(() => {})}
                >
                  <Check size={14} aria-hidden="true" /> {t('matchSquad.statusPlaying')}
                </Button>
                <Button
                  variant={entry.status === 'reserve' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setStatus(entry.rosterPlayerId, 'reserve').catch(() => {})}
                >
                  <Users size={14} aria-hidden="true" /> {t('matchSquad.statusReserve')}
                </Button>
                <Button
                  variant={entry.status === 'injured' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setStatus(entry.rosterPlayerId, 'injured').catch(() => {})}
                >
                  <AlertTriangle size={14} aria-hidden="true" /> {t('matchSquad.statusInjured')}
                </Button>
                <Button
                  variant={entry.status === 'absent' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setStatus(entry.rosterPlayerId, 'absent').catch(() => {})}
                >
                  <X size={14} aria-hidden="true" /> {t('matchSquad.statusAbsent')}
                </Button>
                {entry.status && (
                  <Button
                    variant="secondary"
                    size="sm"
                    iconOnly
                    onClick={() => clearStatus(entry.rosterPlayerId).catch(() => {})}
                    aria-label={t('matchSquad.clearAriaLabel', { name: entry.name })}
                    title={t('matchSquad.clearTitle')}
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
