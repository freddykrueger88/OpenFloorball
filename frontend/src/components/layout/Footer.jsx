/**
 * Footer – globale Links (Datenschutz, Regelwerk, Unterstützen) auf allen Seiten
 */
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import styles from './Footer.module.css';

export default function Footer() {
  const { t } = useTranslation();
  return (
    <footer className={styles.footer}>
      <p className={styles.slogan}>{t('auth.slogan')}</p>
      <div className={styles.links}>
        <Link to="/privacy">{t('footer.privacyLink')}</Link>
        <Link to="/rules">{t('footer.rulesLink')}</Link>
        <Link to="/support">{t('footer.supportLink')}</Link>
      </div>
      <p className={styles.credit}>{t('footer.credit')}</p>
    </footer>
  );
}
