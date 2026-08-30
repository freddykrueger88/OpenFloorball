/**
 * CarpoolSharePage – öffentliche, tokenbasierte Ansicht EINES Fahrangebots
 * ohne Login (ISSUE 028). Vorbild SharePage.jsx: rohes fetch() statt
 * apiFetch (das eine Cookie-Session annimmt und bei 401 auf /login
 * umleitet – falsch für anonyme Besucher:innen, typischerweise Eltern
 * ohne eigenen Account).
 *
 * Der cancelToken wird bei erfolgreicher Teilnahme EINMALIG vom Server
 * zurückgegeben und hier in localStorage gespeichert – es gibt keine
 * Session, über die sich "mein Eintrag" beim nächsten Besuch sonst
 * feststellen ließe. Geht der Token verloren (anderes Gerät/Browser,
 * Daten gelöscht), bleibt nur der Weg über die anbietende Person/einen
 * Coach (authentifizierte Ansicht kann jeden Claim entfernen).
 */
import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Car } from 'lucide-react';
import Button from '../components/common/Button.jsx';
import styles from './CarpoolSharePage.module.css';

function storageKey(token) {
  return `carpool-claim-${token}`;
}

export default function CarpoolSharePage() {
  const { t } = useTranslation();
  const { token } = useParams();
  const [offer, setOffer] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [claimantName, setClaimantName] = useState('');
  const [myClaim, setMyClaim] = useState(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);

  const loadOffer = () => {
    setLoading(true);
    return fetch(`/api/carpools/${token}`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.message ?? t('carpoolSharePage.linkInvalid'));
        return json.data;
      })
      .then((data) => setOffer(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let cancelled = false;
    loadOffer().then(() => {
      if (cancelled) return;
      const stored = window.localStorage.getItem(storageKey(token));
      if (stored) {
        try { setMyClaim(JSON.parse(stored)); } catch { /* korruptes Storage – ignorieren */ }
      }
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleClaim = async (e) => {
    e.preventDefault();
    const trimmed = claimantName.trim();
    if (!trimmed) return;
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/carpools/${token}/claims`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimantName: trimmed }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message ?? t('carpoolSharePage.linkInvalid'));
      window.localStorage.setItem(storageKey(token), JSON.stringify(json.data));
      setMyClaim(json.data);
      await loadOffer();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleWithdraw = async () => {
    if (!myClaim) return;
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/carpools/${token}/claims/${myClaim.claimId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancelToken: myClaim.cancelToken }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message ?? t('carpoolSharePage.linkInvalid'));
      window.localStorage.removeItem(storageKey(token));
      setMyClaim(null);
      await loadOffer();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-page" id="main-content">
      <div className="auth-card">
        {loading ? (
          <p className={styles.centerMsg}>{t('carpoolSharePage.loading')}</p>
        ) : error || !offer ? (
          <p className={styles.centerMsg} role="alert"><AlertTriangle size={16} aria-hidden="true" /> {error ?? t('carpoolSharePage.linkInvalid')}</p>
        ) : (
          <>
            <h1 className={styles.title}><Car size={20} aria-hidden="true" /> {t('carpoolSharePage.title')}</h1>
            {offer.resource?.label && (
              <p className={styles.resourceLabel}>
                {offer.resource.label}
                {offer.resource.date ? ` · ${offer.resource.date}` : ''}
              </p>
            )}

            <dl className={styles.infoList}>
              <div className={styles.infoRow}><dt>{t('carpool.offerForm.meetingPointAriaLabel')}</dt><dd>{offer.meetingPoint}</dd></div>
              {offer.note && <div className={styles.infoRow}><dt>{t('carpool.offerForm.noteAriaLabel')}</dt><dd>{offer.note}</dd></div>}
              <div className={styles.infoRow}>
                <dt>{t('carpool.offerForm.seatsLabel')}</dt>
                <dd>{offer.freeSeats === 0 ? t('carpoolSharePage.seatsFull') : t('carpoolSharePage.seatsFree', { free: offer.freeSeats, total: offer.totalSeats })}</dd>
              </div>
            </dl>

            {offer.riders.length > 0 && (
              <ul className={styles.riderList} aria-label={t('carpool.riderListAriaLabel')}>
                {offer.riders.map((r, i) => <li key={i} className={styles.rider}>{r.name}</li>)}
              </ul>
            )}

            {actionError && <p className={styles.msgError}><AlertTriangle size={16} aria-hidden="true" /> {actionError}</p>}

            {myClaim ? (
              <>
                <Button variant="secondary" size="md" className={styles.fullWidthBtn} onClick={handleWithdraw} disabled={busy}>
                  {t('carpoolSharePage.withdrawBtn')}
                </Button>
                <p className={styles.hint}>{t('carpoolSharePage.withdrawnHint')}</p>
              </>
            ) : (
              <form onSubmit={handleClaim} className={styles.form}>
                <input
                  type="text"
                  className={styles.textInput}
                  value={claimantName}
                  onChange={(e) => setClaimantName(e.target.value)}
                  placeholder={t('carpoolSharePage.claimNamePlaceholder')}
                  aria-label={t('carpoolSharePage.claimNameAriaLabel')}
                  maxLength={100}
                  disabled={offer.freeSeats === 0}
                />
                <Button type="submit" variant="primary" size="md" className={styles.fullWidthBtn} disabled={busy || offer.freeSeats === 0 || !claimantName.trim()}>
                  {t('carpoolSharePage.claimBtn')}
                </Button>
              </form>
            )}
          </>
        )}
      </div>
    </main>
  );
}
