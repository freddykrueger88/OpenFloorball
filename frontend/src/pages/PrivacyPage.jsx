/**
 * PrivacyPage – Datenschutzerklärung (Issue #20, DSGVO)
 * Öffentlich erreichbar, kein Login nötig (analog zu SharePage).
 */
import { useTranslation } from 'react-i18next';
import styles from './PrivacyPage.module.css';

export default function PrivacyPage() {
  const { t } = useTranslation();
  return (
    <main className={styles.page} id="main-content">
      <header className={styles.header}>
        <h1 className={styles.title}>{t('privacyPage.title')}</h1>
      </header>

      <div className={styles.content}>
        <section className={styles.section}>
          <h2>{t('privacyPage.operator.title')}</h2>
          <p>{t('privacyPage.operator.body')}</p>
        </section>

        <section className={styles.section}>
          <h2>{t('privacyPage.dataCategories.title')}</h2>
          <ul>
            <li>{t('privacyPage.dataCategories.account')}</li>
            <li>{t('privacyPage.dataCategories.boards')}</li>
            <li>{t('privacyPage.dataCategories.roster')}</li>
            <li>{t('privacyPage.dataCategories.games')}</li>
            <li>{t('privacyPage.dataCategories.training')}</li>
            <li>{t('privacyPage.dataCategories.settings')}</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>{t('privacyPage.purpose.title')}</h2>
          <p>{t('privacyPage.purpose.body')}</p>
        </section>

        <section className={styles.section}>
          <h2>{t('privacyPage.rights.title')}</h2>
          <p>{t('privacyPage.rights.intro')}</p>
          <ul>
            <li><strong>{t('privacyPage.rights.accessTitle')}</strong> {t('privacyPage.rights.accessBody')}</li>
            <li><strong>{t('privacyPage.rights.exportTitle')}</strong> {t('privacyPage.rights.exportBody')}</li>
            <li><strong>{t('privacyPage.rights.rectifyTitle')}</strong> {t('privacyPage.rights.rectifyBody')}</li>
            <li><strong>{t('privacyPage.rights.deleteTitle')}</strong> {t('privacyPage.rights.deleteBody')}</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>{t('privacyPage.shareLinkNotice.title')}</h2>
          <p>{t('privacyPage.shareLinkNotice.body')}</p>
        </section>

        <section className={styles.section}>
          <h2>{t('privacyPage.noThirdParty.title')}</h2>
          <p>{t('privacyPage.noThirdParty.body')}</p>
        </section>

        <section className={styles.section}>
          <h2>{t('privacyPage.security.title')}</h2>
          <p>{t('privacyPage.security.body')}</p>
        </section>
      </div>
    </main>
  );
}
