/**
 * MatchCountdown – Countdown-Anzeige für Spiel-/Trainingskarten (Spieler-
 * Dashboard-Ausbau). Aktualisiert sich jede Minute selbst (kein Sekunden-
 * Takt nötig, siehe getCountdown), räumt sein Intervall beim Unmount aber
 * garantiert wieder auf.
 */
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getCountdown } from '../../utils/countdown.js';
import styles from './MatchCountdown.module.css';

const TICK_MS = 60 * 1000;

export default function MatchCountdown({ targetDate }) {
  const { t } = useTranslation();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  if (!targetDate) return null;
  const c = getCountdown(targetDate, now);
  if (!c) return null;

  let label;
  if (c.isLive) {
    label = t('dashboard.countdown.live');
  } else if (c.isPast) {
    label = t('dashboard.countdown.past');
  } else if (c.isToday) {
    const time = targetDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    label = t('dashboard.countdown.today', { time });
  } else if (c.days === 0) {
    label = t('dashboard.countdown.hoursMinutes', { hours: c.hours, minutes: c.minutes });
  } else {
    label = t('dashboard.countdown.daysHours', { days: c.days, hours: c.hours });
  }

  return (
    <p className={`${styles.countdown} ${c.isLive ? styles.live : ''}`} role="status">
      {label}
    </p>
  );
}
