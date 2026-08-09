/**
 * CalendarFeedPanel – ICS-Kalender-Abo (Roadmap-Audit, letzter Punkt aus
 * Phase B). Direkt auf CalendarPage.jsx statt in den globalen
 * Einstellungen, analog zu Board-Share-Links direkt am Board (siehe
 * ExportPanel.jsx) statt in Settings.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCalendarFeed } from '../../hooks/useCalendarFeed.js';
import Button from '../common/Button.jsx';
import styles from './CalendarFeedPanel.module.css';

// Google/Apple/Outlook öffnen den Kalender-Abo-Dialog direkt über das
// webcal://-Schema; die reine https://-URL bleibt für den manuellen
// Import (z.B. Google Calendar "Von URL") zusätzlich als Kopiertext.
function toWebcalUrl(httpsUrl) {
  return httpsUrl.replace(/^https?:\/\//i, 'webcal://');
}

export default function CalendarFeedPanel() {
  const { t } = useTranslation();
  const { feedUrl, loading, error, fetchStatus, generate, revoke } = useCalendarFeed();
  const [copied, setCopied] = useState(false);

  useEffect(() => { fetchStatus().catch(() => {}); }, [fetchStatus]);

  const handleCopy = async () => {
    if (!feedUrl) return;
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Zwischenablage evtl. ohne Berechtigung – Link steht trotzdem im Feld zum manuellen Kopieren
    }
  };

  return (
    <div className={styles.panel}>
      <h2 className={styles.title}>{t('calendar.feed.title')}</h2>
      <p className={styles.hint}>{t('calendar.feed.hint')}</p>

      {error && <p className={styles.msgError}>{t('calendar.feed.error', { error })}</p>}

      {feedUrl ? (
        <>
          <div className={styles.row}>
            <input
              type="text"
              readOnly
              value={feedUrl}
              className={styles.urlInput}
              onFocus={(e) => e.target.select()}
              aria-label={t('calendar.feed.urlAriaLabel')}
            />
            <Button variant="secondary" size="sm" onClick={handleCopy}>
              {copied ? t('calendar.feed.copied') : t('calendar.feed.copy')}
            </Button>
          </div>
          <div className={styles.actions}>
            <a href={toWebcalUrl(feedUrl)} className={styles.subscribeBtn}>
              {t('calendar.feed.subscribe')}
            </a>
            <Button variant="secondary" size="sm" onClick={() => generate().catch(() => {})} disabled={loading}>
              {t('calendar.feed.regenerate')}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => revoke().catch(() => {})} disabled={loading}>
              {t('calendar.feed.revoke')}
            </Button>
          </div>
        </>
      ) : (
        <Button variant="primary" size="md" onClick={() => generate().catch(() => {})} disabled={loading}>
          {loading ? t('calendar.feed.generating') : t('calendar.feed.generate')}
        </Button>
      )}
    </div>
  );
}
