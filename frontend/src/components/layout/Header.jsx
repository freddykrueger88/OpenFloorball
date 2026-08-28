/**
 * Header – globale Kopfzeile: Marke, Hauptnavigation, Sprachauswahl,
 * Logout. Ersetzt die bisher pro Seite duplizierte Ad-hoc-Navigation
 * nicht, ergänzt sie als eine gemeinsame, immer sichtbare Leiste
 * (auch auf öffentlichen Seiten wie Login/Privacy/Rules/Share).
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Menu, X, ChevronDown, Settings as SettingsIcon } from 'lucide-react';
import useAuthStore from '../../store/authStore.js';
import { apiFetch } from '../../utils/apiFetch.js';
import { useFocusTrap } from '../../hooks/useFocusTrap.js';
import logo from '../../assets/openfloorball_logo_cropped.png';
import Button from '../common/Button.jsx';
import styles from './Header.module.css';

const LANGUAGES = ['de', 'en'];

// UI/UX-Audit 2026-08-28: 13 gleichrangige Nav-Links passten nicht mehr
// entspannt in eine Zeile und waren auch im mobilen Menü eine undifferenzierte
// lange Liste. Gruppierung nach Trainer-Workflow (CLAUDE.md §7 Coach Workflow
// First) statt technischer Reihenfolge – Desktop bekommt dadurch aufklappbare
// Untermenüs (siehe navGroup* unten), das mobile Menü bekommt dieselben
// Gruppen als Abschnitts-Überschriften (kein zweites Interaktionsmuster nötig,
// dort ist ohnehin schon vertikaler Scroll-Platz). `tourId` verweist wie
// gehabt auf ein `data-tour`-Attribut für die Onboarding-Tour
// (tourSteps.js) – zeigt jetzt auf den Gruppen-Trigger statt auf einen
// einzelnen Unterpunkt, da nur der Trigger unabhängig vom Auf-/Zuklappen
// immer sichtbar ist.
function buildNavGroups(t) {
  return [
    {
      key: 'boards',
      labelKey: 'nav.groups.boards',
      tourId: 'nav-group-boards',
      links: [
        { to: '/boards', label: t('nav.boards') },
        { to: '/trainings', label: t('nav.trainings') },
      ],
    },
    {
      key: 'roster',
      labelKey: 'nav.groups.roster',
      tourId: 'nav-group-roster',
      links: [
        { to: '/roster', label: t('nav.roster') },
        { to: '/lines', label: t('nav.lines') },
      ],
    },
    {
      key: 'games',
      labelKey: 'nav.groups.games',
      tourId: 'nav-group-games',
      links: [
        { to: '/games', label: t('nav.games') },
        { to: '/opponents', label: t('nav.opponents') },
        { to: '/stats', label: t('nav.stats') },
        { to: '/calendar', label: t('nav.calendar') },
      ],
    },
    {
      key: 'team',
      labelKey: 'nav.groups.team',
      tourId: 'nav-group-team',
      links: [
        { to: '/news', label: t('nav.news') },
        { to: '/polls', label: t('nav.polls') },
      ],
    },
    {
      key: 'knowledge',
      labelKey: 'nav.groups.knowledge',
      tourId: 'nav-group-knowledge',
      links: [
        { to: '/library', label: t('nav.library') },
        { to: '/knowledge', label: t('nav.knowledge') },
      ],
    },
  ];
}

export default function Header() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState(null);
  const menuRef = useRef(null);
  const navRef = useRef(null);
  const groupTriggerRefs = useRef({});
  const navGroups = buildNavGroups(t);

  // Menü bei Routenwechsel schließen (z.B. nach Klick auf einen Nav-Link),
  // sonst bliebe es auf der neuen Seite fälschlich offen stehen.
  useEffect(() => { setMenuOpen(false); setOpenGroup(null); }, [location.pathname]);

  useFocusTrap(menuRef, { active: menuOpen, onEscape: () => setMenuOpen(false) });

  // Ein aufklappbares Untermenü ist bewusst KEIN Fokus-Trap (anders als das
  // mobile Hamburger-Menü oben) – WAI-ARIA-Praxis für Navigations-Dropdowns:
  // Tab führt aus dem Menü heraus zum nächsten Seitenelement weiter, statt
  // den Fokus gefangen zu halten. Schließen erfolgt per Klick außerhalb,
  // Escape (mit Fokus-Rückgabe an den Trigger) oder Klick auf einen Link.
  useEffect(() => {
    if (!openGroup) return undefined;
    const handlePointerDown = (e) => {
      if (!navRef.current?.contains(e.target)) setOpenGroup(null);
    };
    const handleKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      groupTriggerRefs.current[openGroup]?.focus();
      setOpenGroup(null);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openGroup]);

  const changeLanguage = (lang) => {
    if (lang === i18n.language) return;
    i18n.changeLanguage(lang);
    if (user) {
      apiFetch('/api/settings', { method: 'PUT', body: JSON.stringify({ language: lang }) }).catch(() => {});
    }
  };

  return (
    <header className={styles.header}>
      <a href="#main-content" className="sr-only sr-only-focusable">{t('accessibility.skipToContent')}</a>

      <Link to={user ? '/boards' : '/'} className={styles.brand} aria-label={t('nav.brandHome')}>
        <span className={styles.brandLogoBackdrop}>
          <img src={logo} alt="OpenFloorball" className={styles.brandLogo} />
        </span>
      </Link>

      {user && (
        <nav ref={navRef} className={styles.nav} aria-label={t('nav.mainNavigation')}>
          {navGroups.map((group) => {
            const isActiveGroup = group.links.some((link) => location.pathname.startsWith(link.to));
            const isOpen = openGroup === group.key;
            return (
              <div key={group.key} className={styles.navGroup}>
                <button
                  type="button"
                  ref={(el) => { groupTriggerRefs.current[group.key] = el; }}
                  data-tour={group.tourId}
                  aria-expanded={isOpen}
                  aria-haspopup="true"
                  aria-controls={`nav-group-panel-${group.key}`}
                  className={`${styles.navLink} ${styles.navGroupTrigger} ${isActiveGroup ? styles.navLinkActive : ''}`}
                  onClick={() => setOpenGroup((prev) => (prev === group.key ? null : group.key))}
                >
                  {t(group.labelKey)}
                  <ChevronDown size={14} aria-hidden="true" className={styles.navGroupChevron} />
                </button>
                {isOpen && (
                  <div id={`nav-group-panel-${group.key}`} className={styles.navGroupPanel}>
                    {group.links.map((link) => (
                      <Link
                        key={link.to}
                        to={link.to}
                        className={`${styles.navGroupPanelLink} ${location.pathname.startsWith(link.to) ? styles.navLinkActive : ''}`}
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          <Link
            to="/settings"
            data-tour="nav-settings"
            className={`${styles.navLink} ${styles.navSettingsIcon} ${location.pathname.startsWith('/settings') ? styles.navLinkActive : ''}`}
            aria-label={t('nav.settings')}
            title={t('nav.settings')}
          >
            <SettingsIcon size={20} aria-hidden="true" />
          </Link>
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
              {navGroups.map((group) => (
                <div key={group.key} className={styles.menuGroup}>
                  {/* data-tour hier auf der (nicht interaktiven) Gruppen-
                      Überschrift statt auf einem einzelnen Link – dieselbe
                      Rolle wie der Dropdown-Trigger in der Desktop-Leiste,
                      siehe TourOverlay.jsx (wählt das erste sichtbare
                      Element mit passendem data-tour aus). */}
                  <p className={styles.menuGroupLabel} data-tour={group.tourId}>{t(group.labelKey)}</p>
                  {group.links.map((link) => (
                    <Link
                      key={link.to}
                      to={link.to}
                      className={`${styles.menuLink} ${location.pathname.startsWith(link.to) ? styles.navLinkActive : ''}`}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              ))}
              <Link
                to="/settings"
                data-tour="nav-settings"
                className={`${styles.menuLink} ${location.pathname.startsWith('/settings') ? styles.navLinkActive : ''}`}
              >
                {t('nav.settings')}
              </Link>
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
