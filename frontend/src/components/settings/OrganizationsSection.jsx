/**
 * OrganizationsSection – Vereine anlegen + Übersicht (ROADMAP Phase 2,
 * ausgebaut per Roadmap-Audit "Vereinsebene ausbauen"). Die eigentliche
 * Verwaltung (Mitglieder, Teams des Vereins) lebt jetzt auf einer
 * eigenen Seite (OrganizationPage.jsx, verlinkt aus der Liste unten) –
 * bewusst nicht mehr dupliziert hier, damit es nur eine Stelle mit
 * Mitgliederverwaltung gibt.
 *
 * Vereine-Ausbau: bekommt den Vereins-Zustand jetzt per `organizationsApi`
 * von SettingsPage.jsx injiziert statt selbst useOrganizations() zu rufen
 * – dieser Tab existiert ohnehin nur, solange organizations.length > 0
 * (siehe SettingsPage.jsx), ein zweiter, eigener Fetch wäre nur
 * redundant.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { AlertTriangle } from 'lucide-react';
import Button from '../common/Button.jsx';
import styles from '../../pages/SettingsPage.module.css';
import linkStyles from './OrganizationsSection.module.css';

export default function OrganizationsSection({ organizationsApi }) {
  const { t } = useTranslation();
  const { organizations, error: orgsError, createOrganization } = organizationsApi;

  const [newOrgName, setNewOrgName] = useState('');

  const handleCreateOrg = async (e) => {
    e.preventDefault();
    const trimmed = newOrgName.trim();
    if (!trimmed) return;
    try {
      await createOrganization(trimmed);
      setNewOrgName('');
    } catch { /* error via hook */ }
  };

  return (
    <section className={styles.section}>
      <h2>{t('settings.nav.organizations')}</h2>
      <p className={styles.hint}>{t('settings.organizations.intro')}</p>

      {orgsError && <p className={styles.msgError}><AlertTriangle size={16} aria-hidden="true" /> {orgsError}</p>}

      <form className={styles.subForm} onSubmit={handleCreateOrg}>
        <h3 className={styles.subTitle}>{t('settings.organizations.createTitle')}</h3>
        <input
          className={styles.textInput}
          value={newOrgName}
          onChange={(e) => setNewOrgName(e.target.value)}
          placeholder={t('settings.organizations.namePlaceholder')}
          maxLength={80}
          aria-label={t('settings.organizations.namePlaceholder')}
        />
        <Button type="submit" variant="primary" size="md" className={styles.submitBtn} disabled={!newOrgName.trim()}>
          {t('settings.organizations.createBtn')}
        </Button>
      </form>

      {organizations.length === 0 ? (
        <p className={styles.hint}>{t('settings.organizations.noOrganizations')}</p>
      ) : (
        <ul className={styles.teamList} role="list">
          {organizations.map((org) => (
            <li key={org._id} className={styles.teamRow}>
              <Link to={`/organizations/${org._id}`} className={linkStyles.orgLink}>
                <span>{org.name}</span>
                <span className={styles.roleBadge}>{t(`settings.organizations.role.${org.role}`)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
