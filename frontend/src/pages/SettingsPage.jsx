/**
 * SettingsPage – Zentrale Einstellungsseite (Issue #18)
 *
 * UI/UX-Audit, Stufe 3: war vorher eine 1011-Zeilen-Datei mit Account/
 * Daten/Admin/Backups/Teams/Vereinen/Darstellung untereinander auf einer
 * langen Scroll-Seite. Jetzt eine schlanke Hülle, die per SettingsTabs
 * zwischen sechs eigenständigen Section-Komponenten umschaltet (siehe
 * components/settings/) – jede Section holt sich ihre Daten/Hooks selbst,
 * kein Prop-Drilling von hier aus nötig.
 *
 * Ausnahme (Vereine-Ausbau): den "Vereine"-Tab gibt es nur noch, wenn der
 * Account bereits Mitglied eines Vereins ist – für die meisten Trainer mit
 * genau einem Team ist ein Verein schlicht dasselbe wie ihr Team ("TB
 * Uphusen" = das Team, nicht eine zweite Organisationsebene) und der Tab
 * war nur verwirrende, leere Oberfläche. Die Vereins-Ebene lohnt sich erst,
 * sobald jemand mehrere Teams unter einem Dach führt – Einstieg dafür ist
 * jetzt ein unauffälliger "Verein gründen"-Hinweis im Teams-Tab
 * (TeamsSection.jsx). `useOrganizations()` läuft deshalb HIER (nicht mehr
 * in TeamsSection/OrganizationsSection selbst), damit beide Sections
 * denselben, konsistenten Vereins-Stand sehen und ein frisch gegründeter
 * Verein sofort den Tab erscheinen lässt.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import useAuthStore from '../store/authStore.js';
import { useSettings } from '../hooks/useSettings.js';
import { useOrganizations } from '../hooks/useOrganizations.js';
import SettingsTabs from '../components/settings/SettingsTabs.jsx';
import PreferencesSection from '../components/settings/PreferencesSection.jsx';
import AccountSection from '../components/settings/AccountSection.jsx';
import TeamsSection from '../components/settings/TeamsSection.jsx';
import OrganizationsSection from '../components/settings/OrganizationsSection.jsx';
import DataSection from '../components/settings/DataSection.jsx';
import DemoDataSection from '../components/settings/DemoDataSection.jsx';
import AdminSection from '../components/settings/AdminSection.jsx';
import LibraryModerationSection from '../components/settings/LibraryModerationSection.jsx';
import styles from './SettingsPage.module.css';

export default function SettingsPage() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { loading } = useSettings();
  const isAdmin = user?.role === 'admin';

  const organizationsApi = useOrganizations();
  const { organizations, fetchOrganizations } = organizationsApi;
  useEffect(() => { fetchOrganizations().catch(() => {}); }, [fetchOrganizations]);
  const hasOrganizations = organizations.length > 0;

  const [activeTabId, setActiveTabId] = useState('appearance');
  const handleOrganizationFounded = () => setActiveTabId('organizations');

  if (loading) return <p className={styles.loadingMsg}>{t('settings.loadingPage')}</p>;

  const tabs = [
    { id: 'appearance',    label: t('settings.nav.appearance'),    content: <PreferencesSection /> },
    { id: 'account',       label: t('settings.nav.account'),       content: <AccountSection /> },
    { id: 'teams',         label: t('settings.nav.teams'),         content: (
      <TeamsSection organizationsApi={organizationsApi} onOrganizationFounded={handleOrganizationFounded} />
    ) },
    hasOrganizations && { id: 'organizations', label: t('settings.nav.organizations'), content: (
      <OrganizationsSection organizationsApi={organizationsApi} />
    ) },
    { id: 'data',          label: t('settings.nav.data'),          content: <DataSection /> },
    { id: 'demo-data',     label: t('settings.nav.demoData'),      content: <DemoDataSection /> },
    isAdmin && { id: 'admin', label: t('settings.nav.admin'), content: <AdminSection /> },
    isAdmin && { id: 'library-moderation', label: t('settings.nav.libraryModeration'), content: <LibraryModerationSection /> },
  ].filter(Boolean);

  return (
    <main className={styles.page} id="main-content">
      <header className={styles.header}>
        <Link to="/boards" className={styles.backLink} aria-label={t('settings.backLink')}>←</Link>
        <h1 className={styles.title}>{t('settings.title')}</h1>
      </header>

      <SettingsTabs tabs={tabs} activeId={activeTabId} onActiveIdChange={setActiveTabId} />
    </main>
  );
}
