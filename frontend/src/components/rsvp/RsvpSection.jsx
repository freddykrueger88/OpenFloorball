/**
 * RsvpSection – Zusage/Absage/Unsicher für Spiele und Trainingseinheiten
 * (Roadmap-Audit: RSVP/Anwesenheit). Generisch über resourceKind
 * ('games' | 'trainings') + resourceId, siehe useRsvps.js – Struktur
 * analog CommentsPanel.jsx. Rendert nichts, wenn die Ressource keinem
 * Team zugeordnet ist (kein Empfängerkreis, siehe rsvpsController.js).
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Check, X, HelpCircle } from 'lucide-react';
import useAuthStore from '../../store/authStore.js';
import { useRsvps } from '../../hooks/useRsvps.js';
import Button from '../common/Button.jsx';
import styles from './RsvpSection.module.css';

const QUICK_REASONS = ['sick', 'injured', 'work', 'vacation', 'school', 'private'];

export default function RsvpSection({ resourceKind, resourceId, teamId }) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { roster, loading, error, fetchRsvps, setMyRsvp } = useRsvps(resourceKind, resourceId);

  const [reasonDraft, setReasonDraft] = useState('');
  const myEntry = roster.find((r) => r.userId === user?.id);

  useEffect(() => { if (teamId) fetchRsvps().catch(() => {}); }, [fetchRsvps, teamId]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setReasonDraft(myEntry?.status === 'no' ? (myEntry.reason ?? '') : ''); }, [myEntry?.status]);

  if (!teamId) return null;

  const respond = (status, reason = '') => setMyRsvp(status, reason).catch(() => {});

  const statusLabel = (status) => {
    if (status === 'yes')   return t('rsvp.statusYes');
    if (status === 'no')    return t('rsvp.statusNo');
    if (status === 'maybe') return t('rsvp.statusMaybe');
    return t('rsvp.statusNone');
  };

  return (
    <section className={styles.panel} aria-label={t('rsvp.ariaLabel')}>
      <h3 className={styles.heading}>{t('rsvp.title')}</h3>

      {error && <p className={styles.msgError}><AlertTriangle size={16} aria-hidden="true" /> {error}</p>}

      {loading && roster.length === 0 ? (
        <p className={styles.hint}>{t('rsvp.loading')}</p>
      ) : (
        <ul className={styles.list} role="list">
          {roster.map((entry) => {
            const isMe = entry.userId === user?.id;
            return (
              <li key={entry.userId} className={styles.item}>
                <div className={styles.itemRow}>
                  <span className={styles.email}>{isMe ? t('rsvp.you') : entry.email}</span>
                  {!isMe && (
                    <span className={`${styles.statusChip} ${styles[`status-${entry.status ?? 'none'}`]}`}>
                      {statusLabel(entry.status)}
                    </span>
                  )}
                </div>

                {isMe && (
                  <div className={styles.myActions} role="group" aria-label={t('rsvp.respondAriaLabel')}>
                    <Button
                      variant={entry.status === 'yes' ? 'primary' : 'secondary'}
                      size="sm"
                      onClick={() => respond('yes')}
                    >
                      <Check size={14} aria-hidden="true" /> {t('rsvp.statusYes')}
                    </Button>
                    <Button
                      variant={entry.status === 'maybe' ? 'primary' : 'secondary'}
                      size="sm"
                      onClick={() => respond('maybe')}
                    >
                      <HelpCircle size={14} aria-hidden="true" /> {t('rsvp.statusMaybe')}
                    </Button>
                    <Button
                      variant={entry.status === 'no' ? 'primary' : 'secondary'}
                      size="sm"
                      onClick={() => respond('no', entry.reason ?? '')}
                    >
                      <X size={14} aria-hidden="true" /> {t('rsvp.statusNo')}
                    </Button>
                  </div>
                )}

                {isMe && entry.status === 'no' && (
                  <div className={styles.reasonBox}>
                    <div className={styles.reasonQuickRow}>
                      {QUICK_REASONS.map((key) => (
                        <button
                          key={key}
                          type="button"
                          className={styles.reasonChip}
                          onClick={() => { setReasonDraft(t(`rsvp.reason.${key}`)); respond('no', t(`rsvp.reason.${key}`)); }}
                        >
                          {t(`rsvp.reason.${key}`)}
                        </button>
                      ))}
                    </div>
                    <input
                      className={styles.reasonInput}
                      value={reasonDraft}
                      onChange={(e) => setReasonDraft(e.target.value)}
                      onBlur={() => respond('no', reasonDraft)}
                      onKeyDown={(e) => { if (e.key === 'Enter') respond('no', reasonDraft); }}
                      placeholder={t('rsvp.reasonPlaceholder')}
                      maxLength={200}
                      aria-label={t('rsvp.reasonAriaLabel')}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
