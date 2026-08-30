/**
 * BirthdayCard – zeigt, wer im Team als Nächstes bzw. heute Geburtstag
 * hat (Spieler-Dashboard-Ausbau). Selbstständig ladend (wie
 * AvailabilityToggle.jsx), nicht über useDashboardData.js, da die
 * Geburtstagsliste unabhängig von "meinem Team"/Saisonmanager ist.
 *
 * Klick-Gimmick (Nutzerwunsch): löst einen kurzen Konfetti-Effekt aus –
 * rein dekorativ, funktioniert unabhängig davon, ob heute tatsächlich
 * jemand Geburtstag hat.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Cake, PartyPopper } from 'lucide-react';
import { useTeamBirthdays } from '../../hooks/useTeamBirthdays.js';
import { selectUpcomingBirthdays } from '../../utils/birthdaySelectors.js';
import useAnnounceStore from '../../store/announceStore.js';
import ConfettiOverlay from './ConfettiOverlay.jsx';
import styles from './BirthdayCard.module.css';

export default function BirthdayCard() {
  const { t } = useTranslation();
  const { birthdays, fetchBirthdays } = useTeamBirthdays();
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => { fetchBirthdays().catch(() => {}); }, [fetchBirthdays]);

  const upcoming = selectUpcomingBirthdays(birthdays);
  const today = upcoming.filter((b) => b.isToday);
  const next = upcoming.find((b) => !b.isToday);

  const handleCelebrate = () => {
    setShowConfetti(true);
    useAnnounceStore.getState().announce(t('dashboard.birthdays.confettiAnnouncement'));
  };

  return (
    <section className={styles.card} aria-labelledby="birthday-card-title">
      <div className={styles.header}>
        <h2 id="birthday-card-title" className={styles.title}>
          <Cake size={18} aria-hidden="true" /> {t('dashboard.birthdays.title')}
        </h2>
        <button type="button" className={styles.celebrateBtn} onClick={handleCelebrate} aria-label={t('dashboard.birthdays.celebrateAriaLabel')}>
          <PartyPopper size={18} aria-hidden="true" />
        </button>
      </div>

      {upcoming.length === 0 && (
        <p className={styles.emptyHint}>{t('dashboard.birthdays.empty')}</p>
      )}

      {today.length > 0 && (
        <ul className={styles.todayList} role="list">
          {today.map((b) => (
            <li key={b._id} className={styles.todayItem}>
              🎉 {t('dashboard.birthdays.todayEntry', { name: b.name, age: b.turningAge })}
            </li>
          ))}
        </ul>
      )}

      {today.length === 0 && next && (
        <p className={styles.nextEntry}>
          {t('dashboard.birthdays.nextEntry', { name: next.name, age: next.turningAge, count: next.daysUntil })}
        </p>
      )}

      {showConfetti && <ConfettiOverlay onDone={() => setShowConfetti(false)} />}
    </section>
  );
}
