/**
 * TeamSaisonmanagerSettings – optionale, owner-only Anbindung eines Teams
 * an die externe Saisonmanager-Liga-Verwaltung (Spieler-Dashboard-Ausbau).
 * Eigene Komponente statt Inline-Hook-Aufruf in TeamsSection.jsx, da dort
 * über mehrere Teams iteriert wird (Hooks dürfen nicht in einer .map()-
 * Schleife aufgerufen werden).
 */
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { useTeamSaisonmanager } from '../../hooks/useTeamSaisonmanager.js';
import Button from '../common/Button.jsx';
import styles from '../../pages/SettingsPage.module.css';

export default function TeamSaisonmanagerSettings({ teamId }) {
  const { t } = useTranslation();
  const { status, error, fetchStatus, connect, disconnect } = useTeamSaisonmanager(teamId);
  const [form, setForm] = useState({ apiKey: '', leagueId: '', smTeamId: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchStatus().catch(() => {}); }, [fetchStatus]);

  const handleConnect = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await connect({ apiKey: form.apiKey.trim(), leagueId: Number(form.leagueId), smTeamId: Number(form.smTeamId) });
      setForm({ apiKey: '', leagueId: '', smTeamId: '' });
    } catch { /* error via hook */ } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    setSaving(true);
    try { await disconnect(); } catch { /* error via hook */ } finally { setSaving(false); }
  };

  return (
    <div className={styles.subForm}>
      <h3 className={styles.subTitle}>{t('settings.saisonmanager.title')}</h3>
      <p className={styles.hint}>{t('settings.saisonmanager.hint')}</p>

      {status?.connected ? (
        <>
          <p className={styles.currentValue}>
            {t('settings.saisonmanager.connected', { leagueId: status.leagueId, smTeamId: status.smTeamId })}
          </p>
          <Button variant="danger" size="sm" onClick={handleDisconnect} disabled={saving}>
            {t('settings.saisonmanager.disconnectBtn')}
          </Button>
        </>
      ) : (
        <form onSubmit={handleConnect} className={styles.subForm}>
          <input
            type="password"
            className={styles.textInput}
            value={form.apiKey}
            onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
            placeholder={t('settings.saisonmanager.apiKeyPlaceholder')}
            aria-label={t('settings.saisonmanager.apiKeyPlaceholder')}
            required
          />
          <input
            type="number"
            className={styles.textInput}
            value={form.leagueId}
            onChange={(e) => setForm((f) => ({ ...f, leagueId: e.target.value }))}
            placeholder={t('settings.saisonmanager.leagueIdPlaceholder')}
            aria-label={t('settings.saisonmanager.leagueIdPlaceholder')}
            required
          />
          <input
            type="number"
            className={styles.textInput}
            value={form.smTeamId}
            onChange={(e) => setForm((f) => ({ ...f, smTeamId: e.target.value }))}
            placeholder={t('settings.saisonmanager.smTeamIdPlaceholder')}
            aria-label={t('settings.saisonmanager.smTeamIdPlaceholder')}
            required
          />
          <Button type="submit" variant="secondary" size="md" className={styles.submitBtn} disabled={saving}>
            {t('settings.saisonmanager.connectBtn')}
          </Button>
        </form>
      )}
      {error && <p className={styles.msgError}><AlertTriangle size={16} aria-hidden="true" /> {error}</p>}
    </div>
  );
}
