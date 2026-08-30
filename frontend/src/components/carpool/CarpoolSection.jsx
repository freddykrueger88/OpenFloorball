/**
 * CarpoolSection – Fahrgemeinschaften für Spiele und Trainingseinheiten
 * (ISSUE 028). Generisch über resourceKind ('games' | 'trainings') +
 * resourceId, siehe useCarpools.js – Struktur analog RsvpSection.jsx/
 * CommentsPanel.jsx. Rendert nichts, wenn die Ressource keinem Team
 * zugeordnet ist (kein Empfängerkreis, wie bei RSVP).
 *
 * Anders als RSVP (ein Status pro Person) kann eine Ressource mehrere
 * unabhängige Angebote verschiedener Mitglieder haben – daher ein
 * "Angebot anlegen"-Formular statt fester Status-Buttons (wie
 * CommentsPanel.jsx).
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Car, Trash2 } from 'lucide-react';
import useAuthStore from '../../store/authStore.js';
import { useCarpools } from '../../hooks/useCarpools.js';
import Button from '../common/Button.jsx';
import styles from './CarpoolSection.module.css';

export default function CarpoolSection({ resourceKind, resourceId, teamId }) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { offers, loading, error, fetchOffers, createOffer, deleteOffer, claimSeat, deleteClaim } = useCarpools(resourceKind, resourceId);

  const [meetingPoint, setMeetingPoint] = useState('');
  const [totalSeats, setTotalSeats] = useState(1);
  const [note, setNote] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => { if (teamId) fetchOffers().catch(() => {}); }, [fetchOffers, teamId]);

  if (!teamId) return null;

  const handleCreate = async (e) => {
    e.preventDefault();
    const trimmed = meetingPoint.trim();
    if (!trimmed) return;
    try {
      await createOffer(trimmed, totalSeats, note.trim());
      setMeetingPoint('');
      setTotalSeats(1);
      setNote('');
    } catch { /* error via hook */ }
  };

  const handleCopyLink = async (offer) => {
    const url = `${window.location.origin}/carpool/${offer.shareToken}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(offer._id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Zwischenablage evtl. ohne Berechtigung – kein weiterer Fallback nötig
    }
  };

  return (
    <section className={styles.panel} aria-label={t('carpool.ariaLabel')}>
      <h3 className={styles.heading}>{t('carpool.title')}</h3>

      {error && <p className={styles.msgError}><AlertTriangle size={16} aria-hidden="true" /> {error}</p>}

      {loading && offers.length === 0 ? (
        <p className={styles.hint}>{t('carpool.loading')}</p>
      ) : offers.length === 0 ? (
        <p className={styles.hint}>{t('carpool.empty')}</p>
      ) : (
        <ul className={styles.list} role="list">
          {offers.map((offer) => {
            const freeSeats = offer.totalSeats - offer.claims.length;
            const myClaim = offer.claims.find((c) => c.userId === user?.id);
            const isOwner = offer.userId === user?.id;
            return (
              <li key={offer._id} className={styles.item}>
                <div className={styles.itemHeader}>
                  <span className={styles.meetingPoint}><Car size={14} aria-hidden="true" /> {offer.meetingPoint}</span>
                  <span className={freeSeats === 0 ? styles.seatsFull : styles.seatsFree}>
                    {freeSeats === 0 ? t('carpool.seatsFull') : t('carpool.seatsFree', { free: freeSeats, total: offer.totalSeats })}
                  </span>
                </div>
                {offer.note && <p className={styles.note}>{offer.note}</p>}

                {offer.claims.length > 0 && (
                  <ul className={styles.riderList} aria-label={t('carpool.riderListAriaLabel')}>
                    {offer.claims.map((c) => (
                      <li key={c._id} className={styles.rider}>
                        {c.userId === user?.id ? t('carpool.you') : (c.claimantName ?? t('carpool.you'))}
                      </li>
                    ))}
                  </ul>
                )}

                <div className={styles.itemActions}>
                  {myClaim ? (
                    <Button variant="secondary" size="sm" onClick={() => deleteClaim(offer._id, myClaim._id).catch(() => {})}>
                      {t('carpool.withdrawClaimBtn')}
                    </Button>
                  ) : (
                    <Button variant="primary" size="sm" onClick={() => claimSeat(offer._id).catch(() => {})} disabled={freeSeats === 0}>
                      {t('carpool.claimBtn')}
                    </Button>
                  )}
                  <Button variant="secondary" size="sm" onClick={() => handleCopyLink(offer)}>
                    {copiedId === offer._id ? t('carpool.linkCopied') : t('carpool.copyLink')}
                  </Button>
                  {isOwner && (
                    <Button variant="danger" size="sm" iconOnly onClick={() => deleteOffer(offer._id).catch(() => {})} aria-label={t('carpool.deleteOfferAriaLabel')}>
                      <Trash2 size={14} aria-hidden="true" />
                    </Button>
                  )}
                </div>
                <p className={styles.shareHint}>{t('carpool.shareHint')}</p>
              </li>
            );
          })}
        </ul>
      )}

      <form className={styles.addForm} onSubmit={handleCreate}>
        <input
          type="text"
          className={styles.textInput}
          value={meetingPoint}
          onChange={(e) => setMeetingPoint(e.target.value)}
          placeholder={t('carpool.offerForm.meetingPointPlaceholder')}
          aria-label={t('carpool.offerForm.meetingPointAriaLabel')}
          maxLength={200}
        />
        <label className={styles.seatsLabel}>
          {t('carpool.offerForm.seatsLabel')}
          <input
            type="number"
            className={styles.seatsInput}
            value={totalSeats}
            onChange={(e) => setTotalSeats(Number(e.target.value))}
            min={1}
            max={8}
            aria-label={t('carpool.offerForm.seatsAriaLabel')}
          />
        </label>
        <input
          type="text"
          className={styles.textInput}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t('carpool.offerForm.notePlaceholder')}
          aria-label={t('carpool.offerForm.noteAriaLabel')}
          maxLength={500}
        />
        <Button type="submit" variant="primary" size="md" className={styles.submitBtn} disabled={!meetingPoint.trim()}>
          {t('carpool.offerForm.submitBtn')}
        </Button>
      </form>
    </section>
  );
}
