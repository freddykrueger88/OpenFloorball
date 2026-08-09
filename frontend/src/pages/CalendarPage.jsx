/**
 * CalendarPage – Monatsansicht für Spiele + Trainingseinheiten
 * (Roadmap-Phase B). Reine Frontend-Arbeit auf vorhandenen Daten
 * (games.playedAt, training_sessions.scheduledDate) – kein neues
 * Backend-Modell.
 *
 * Datumsverarbeitung bewusst ohne `new Date(dateStr)` für Vergleiche
 * (Off-by-one-Risiko durch UTC-Interpretation, siehe
 * utils/formatDate.js:18-23) – Kalendertage entstehen über reine
 * Jahr/Monat/Tag-Integer-Arithmetik und werden als "YYYY-MM-DD"-String
 * direkt mit den Datenfeldern verglichen.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Volleyball, Clipboard } from 'lucide-react';
import { useGames } from '../hooks/useGames.js';
import { useTrainingSessions } from '../hooks/useTrainingSessions.js';
import Button from '../components/common/Button.jsx';
import styles from './CalendarPage.module.css';

const MAX_CHIPS_PER_DAY = 3;
const WEEKDAY_COUNT = 7;

function pad2(n) { return String(n).padStart(2, '0'); }
function dateKey(year, month, day) { return `${year}-${pad2(month + 1)}-${pad2(day)}`; }

function daysInMonth(year, month) { return new Date(year, month + 1, 0).getDate(); }

// Montag = 0 ... Sonntag = 6 (DACH-Konvention, unabhängig von der
// UI-Sprache – JS liefert getDay() mit Sonntag = 0, daher Verschiebung).
function mondayIndex(year, month, day) {
  return (new Date(year, month, day).getDay() + 6) % 7;
}

export default function CalendarPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { games, fetchGames } = useGames();
  const { sessions, fetchSessions } = useTrainingSessions();

  const today = new Date();
  const [view, setView] = useState({ year: today.getFullYear(), month: today.getMonth() });

  useEffect(() => { fetchGames().catch(() => {}); }, [fetchGames]);
  useEffect(() => { fetchSessions().catch(() => {}); }, [fetchSessions]);

  const locale = i18n.language === 'en' ? 'en-US' : 'de-DE';
  const monthLabel = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(view.year, view.month, 1));
  const weekdayLabels = useMemo(() => {
    // Eine beliebige Montag-Woche als Referenz für die Kurz-Wochentagsnamen.
    const formatter = new Intl.DateTimeFormat(locale, { weekday: 'short' });
    return Array.from({ length: WEEKDAY_COUNT }, (_, i) => formatter.format(new Date(2024, 0, 1 + i)));
  }, [locale]);

  const eventsByDate = useMemo(() => {
    const map = new Map();
    for (const game of games) {
      if (!game.playedAt) continue;
      if (!map.has(game.playedAt)) map.set(game.playedAt, { games: [], sessions: [] });
      map.get(game.playedAt).games.push(game);
    }
    for (const session of sessions) {
      if (!session.scheduledDate) continue;
      if (!map.has(session.scheduledDate)) map.set(session.scheduledDate, { games: [], sessions: [] });
      map.get(session.scheduledDate).sessions.push(session);
    }
    return map;
  }, [games, sessions]);

  const todayKey = dateKey(today.getFullYear(), today.getMonth(), today.getDate());

  const cells = useMemo(() => {
    const total = daysInMonth(view.year, view.month);
    const leadingBlanks = mondayIndex(view.year, view.month, 1);
    const list = [];
    for (let i = 0; i < leadingBlanks; i++) list.push(null);
    for (let day = 1; day <= total; day++) list.push(day);
    while (list.length % WEEKDAY_COUNT !== 0) list.push(null);
    return list;
  }, [view]);

  const goToMonth = (offset) => {
    setView((prev) => {
      const d = new Date(prev.year, prev.month + offset, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const goToToday = () => setView({ year: today.getFullYear(), month: today.getMonth() });

  return (
    <main className={styles.page} id="main-content">
      <header className={styles.header}>
        <h1 className={styles.title}>{t('calendar.title')}</h1>
        <div className={styles.nav} role="group" aria-label={t('calendar.navAriaLabel')}>
          <Button variant="secondary" size="sm" iconOnly onClick={() => goToMonth(-1)} aria-label={t('calendar.prevMonthAriaLabel')}>
            <ChevronLeft size={16} aria-hidden="true" />
          </Button>
          <span className={styles.monthLabel}>{monthLabel}</span>
          <Button variant="secondary" size="sm" iconOnly onClick={() => goToMonth(1)} aria-label={t('calendar.nextMonthAriaLabel')}>
            <ChevronRight size={16} aria-hidden="true" />
          </Button>
          <Button variant="secondary" size="sm" onClick={goToToday}>{t('calendar.today')}</Button>
        </div>
      </header>

      <div className={styles.legend}>
        <span className={styles.legendItem}><Volleyball size={14} aria-hidden="true" className={styles.legendGame} /> {t('calendar.legendGames')}</span>
        <span className={styles.legendItem}><Clipboard size={14} aria-hidden="true" className={styles.legendSession} /> {t('calendar.legendTrainings')}</span>
      </div>

      <div className={styles.gridWrap}>
        <div className={styles.grid}>
          {weekdayLabels.map((label) => (
            <div key={label} className={styles.weekdayHeader}>{label}</div>
          ))}
          {cells.map((day, idx) => {
            if (day === null) return <div key={`blank-${idx}`} className={styles.cellBlank} />;
            const key = dateKey(view.year, view.month, day);
            const dayEvents = eventsByDate.get(key);
            const allEvents = dayEvents ? [
              ...dayEvents.games.map((g) => ({ kind: 'game', id: g._id, label: g.opponent || t('calendar.unnamedGame') })),
              ...dayEvents.sessions.map((s) => ({ kind: 'session', id: s._id, label: s.name })),
            ] : [];
            const visible = allEvents.slice(0, MAX_CHIPS_PER_DAY);
            const overflow = allEvents.length - visible.length;
            return (
              <div key={key} className={`${styles.cell} ${key === todayKey ? styles.cellToday : ''}`}>
                <span className={styles.dayNumber}>{day}</span>
                <div className={styles.chips}>
                  {visible.map((ev) => (
                    <button
                      key={`${ev.kind}-${ev.id}`}
                      type="button"
                      className={`${styles.chip} ${ev.kind === 'game' ? styles.chipGame : styles.chipSession}`}
                      onClick={() => navigate(ev.kind === 'game' ? `/games/${ev.id}` : `/trainings/${ev.id}`)}
                      title={ev.label}
                    >
                      {ev.label}
                    </button>
                  ))}
                  {overflow > 0 && <span className={styles.overflow}>{t('calendar.moreCount', { count: overflow })}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
