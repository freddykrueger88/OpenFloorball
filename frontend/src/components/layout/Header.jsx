/**
 * Header – globale Kopfzeile: Marke, Hauptnavigation, Sprachauswahl,
 * Logout. Ersetzt die bisher pro Seite duplizierte Ad-hoc-Navigation
 * nicht, ergänzt sie als eine gemeinsame, immer sichtbare Leiste
 * (auch auf öffentlichen Seiten wie Login/Privacy/Rules/Share).
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Menu, X } from 'lucide-react';
import useAuthStore from '../../store/authStore.js';
import { apiFetch } from '../../utils/apiFetch.js';
import { useFocusTrap } from '../../hooks/useFocusTrap.js';
import logo from '../../assets/openfloorball_logo_cropped.png';
import Button from '../common/Button.jsx';
import styles from './Header.module.css';

const LANGUAGES = ['de', 'en'];

export default function Header() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Menü bei Routenwechsel schließen (z.B. nach Klick auf einen Nav-Link),
  // sonst bliebe es auf der neuen Seite fälschlich offen stehen.
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  useFocusTrap(menuRef, { active: menuOpen, onEscape: () => setMenuOpen(false) });

  const changeLanguage = (lang) => {
    if (lang === i18n.language) return;
    i18n.changeLanguage(lang);
    if (user) {
      apiFetch('/api/settings', { method: 'PUT', body: JSON.stringify({ language: lang }) }).catch(() => {});
    }
  };

  // tourId: Ziel-Attribut für die Onboarding-Tour (TourOverlay.jsx sucht
  // per document.querySelector(`[data-tour="${target}"]`)) – nicht jeder
  // Nav-Punkt hat einen Tour-Schritt (bewusst kurz gehalten, siehe dort).
  const navLinks = [
    { to: '/boards',    label: t('nav.boards'),    tourId: 'nav-boards' },
    { to: '/trainings', label: t('nav.trainings'), tourId: 'nav-trainings' },
    { to: '/roster',    label: t('nav.roster') },
    { to: '/lines',     label: t('nav.lines') },
    { to: '/games',     label: t('nav.games') },
    { to: '/library',   label: t('nav.library'),   tourId: 'nav-library' },
    { to: '/knowledge', label: t('nav.knowledge') },
    { to: '/settings',  label: t('nav.settings'),  tourId: 'nav-settings' },
  ];

  return (
    <header className={styles.header}>
      <a href="#main-content" className="sr-only sr-only-focusable">{t('accessibility.skipToContent')}</a>

      <Link to={user ? '/boards' : '/'} className={styles.brand} aria-label={t('nav.brandHome')}>
        <img src={logo} alt="OpenFloorball" className={styles.brandLogo} />
      </Link>

      {user && (
        <nav className={styles.nav} aria-label={t('nav.mainNavigation')}>
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              data-tour={link.tourId}
              className={`${styles.navLink} ${location.pathname.startsWith(link.to) ? styles.navLinkActive : ''}`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}

      <div className={styles.actions}>
        <div className={styles.langToggle} role="group" aria-label={t('settings.language')}>
          {LANGUAGES.map((lang) => (
            <button
              key={lang}
              type="button"
              className={styles.langBtn}
              aria-pressed={i18n.language === lang}
              aria-label={t(lang === 'de' ? 'settings.languageDe' : 'settings.languageEn')}
              onClick={() => changeLanguage(lang)}
            >
              {lang.toUpperCase()}
            </button>
          ))}
        </div>

        {user && (
          <Button variant="secondary" size="sm" className={styles.logoutDesktop} onClick={() => useAuthStore.getState().logout()}>
            {t('nav.logout')}
          </Button>
        )}

        {/* Hamburger-Toggle nur auf schmalen Bildschirmen sichtbar (siehe
            Header.module.css) – die Nav-Leiste oben passt dort nicht mehr
            in eine Zeile und musste sonst horizontal gescrollt werden. */}
        {user && (
          <Button
            variant="secondary"
            size="sm"
            iconOnly
            className={styles.menuToggle}
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? t('nav.closeMenu') : t('nav.openMenu')}
          >
            {menuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
          </Button>
        )}
      </div>

      {user && menuOpen && (
        <div
          className={styles.menuBackdrop}
          onClick={(e) => { if (e.target === e.currentTarget) setMenuOpen(false); }}
        >
          <div ref={menuRef} className={styles.menuPanel} role="dialog" aria-modal="true" aria-label={t('nav.mainNavigation')}>
            <nav aria-label={t('nav.mainNavigation')}>
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  data-tour={link.tourId}
                  className={`${styles.menuLink} ${location.pathname.startsWith(link.to) ? styles.navLinkActive : ''}`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <Button variant="secondary" size="md" className={styles.menuLogoutBtn} onClick={() => useAuthStore.getState().logout()}>
              {t('nav.logout')}
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
