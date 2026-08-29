/**
 * QuickLinksCard – Schnellzugriffe auf vorhandene Kernfunktionen
 * (Spieler-Dashboard-Ausbau). Nur Links auf tatsächlich existierende
 * Routen (siehe App.jsx) – keine erfundenen Funktionen wie Fahrgemein-
 * schaften/Chat/Tabelle, die es im Projekt (noch) nicht gibt.
 */
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import {
  Calendar, Volleyball, Clipboard, Users, BarChart3, BookOpen, Newspaper, Settings,
} from 'lucide-react';
import styles from './QuickLinksCard.module.css';

const LINKS = [
  { to: '/calendar',  icon: Calendar,   labelKey: 'nav.calendar' },
  { to: '/games',     icon: Volleyball, labelKey: 'nav.games' },
  { to: '/trainings', icon: Clipboard,  labelKey: 'nav.trainings' },
  { to: '/roster',    icon: Users,      labelKey: 'nav.roster' },
  { to: '/stats',     icon: BarChart3,  labelKey: 'nav.stats' },
  { to: '/glossary',  icon: BookOpen,   labelKey: 'nav.glossary' },
  { to: '/news',      icon: Newspaper,  labelKey: 'nav.news' },
  { to: '/settings',  icon: Settings,   labelKey: 'nav.settings' },
];

export default function QuickLinksCard() {
  const { t } = useTranslation();

  return (
    <section className={styles.card} aria-labelledby="quick-links-title">
      <h2 id="quick-links-title" className={styles.title}>{t('dashboard.quickLinks.title')}</h2>
      <ul className={styles.grid} role="list">
        {LINKS.map(({ to, icon: Icon, labelKey }) => (
          <li key={to}>
            <Link to={to} className={styles.link} aria-label={t(labelKey)}>
              <Icon size={20} aria-hidden="true" />
              <span>{t(labelKey)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
