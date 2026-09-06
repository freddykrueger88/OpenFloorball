/**
 * SupportPage – zentrale Seite für Spenden- und Mitmach-Optionen.
 * Öffentlich erreichbar, kein Login nötig (analog zu PrivacyPage).
 */
import { useTranslation } from 'react-i18next';
import { SUPPORT_OPTIONS, HELP_OPTIONS } from '../constants/supportOptions.js';
import styles from './SupportPage.module.css';

export default function SupportPage() {
  const { t } = useTranslation();
  return (
    <main className={styles.page} id="main-content">
      <header className={styles.header}>
        <h1 className={styles.title}>{t('supportPage.title')}</h1>
      </header>

      <div className={styles.content}>
        <p className={styles.intro}>{t('supportPage.intro')}</p>

        <section className={styles.section}>
          <h2>{t('supportPage.donations.title')}</h2>
          <div className={styles.grid}>
            {SUPPORT_OPTIONS.map(({ id, href, labelKey, descriptionKey }) => (
              <a key={id} className={styles.card} href={href} target="_blank" rel="noopener noreferrer">
                <h3>{t(labelKey)}</h3>
                <p>{t(descriptionKey)}</p>
              </a>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <h2>{t('supportPage.help.title')}</h2>
          <p className={styles.helpIntro}>{t('supportPage.help.intro')}</p>
          <div className={styles.grid}>
            {HELP_OPTIONS.map(({ id, href, labelKey, descriptionKey }) => (
              <a key={id} className={styles.card} href={href} target="_blank" rel="noopener noreferrer">
                <h3>{t(labelKey)}</h3>
                <p>{t(descriptionKey)}</p>
              </a>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}