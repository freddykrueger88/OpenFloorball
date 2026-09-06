/**
 * Footer – globaler Datenschutz-Link auf allen Seiten (Issue #20, DSGVO)
 */
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import styles from './Footer.module.css';

const DONATE_LINKS = [
  { href: 'https://github.com/sponsors/freddykrueger88', labelKey: 'footer.donateGithub' },
  { href: 'https://opencollective.com/freddykrueger', labelKey: 'footer.donateOpenCollective' },
];

export default function Footer() {
  const { t } = useTranslation();
  return (
    <footer className={styles.footer}>
      <p className={styles.slogan}>{t('auth.slogan')}</p>
      <div className={styles.links}>
        <Link to="/privacy">{t('footer.privacyLink')}</Link>
        <Link to="/rules">{t('footer.rulesLink')}</Link>
        {DONATE_LINKS.map(({ href, labelKey }) => (
          <a key={href} href={href} target="_blank" rel="noopener noreferrer">
            {t(labelKey)}
          </a>
        ))}
      </div>
      <p className={styles.credit}>{t('footer.credit')}</p>
    </footer>
  );
}
