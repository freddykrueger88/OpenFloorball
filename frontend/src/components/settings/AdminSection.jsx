/**
 * AdminSection – Nutzerverwaltung + automatische Backups, nur für Admins
 * (UI/UX-Audit, Stufe 3 – aus der vormals 1011-Zeilen-SettingsPage.jsx
 * ausgelagert, reines Verschieben ohne Logik-Änderung). Wird von
 * SettingsTabs nur als Tab angeboten, wenn isAdmin true ist – geht hier
 * aber trotzdem defensiv nochmal von einem vorhandenen Admin-User aus.
 */
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Check } from 'lucide-react';
import useAuthStore from '../../store/authStore.js';
import { apiFetch } from '../../utils/apiFetch.js';
import { formatDate } from '../../utils/formatDate.js';
import Button from '../common/Button.jsx';
import styles from '../../pages/SettingsPage.module.css';

export default function AdminSection() {
  const { t } = useTranslation();
  const { user } = useAuthStore();

  const [users, setUsers] = useState([]);
  const [adminError, setAdminError] = useState(null);
  const loadUsers = useCallback(async () => {
    try { setUsers(await apiFetch('/api/admin/users')); } catch (err) { setAdminError(err.message); }
  }, []);
  useEffect(() => { loadUsers(); }, [loadUsers]);

  const [backupConfig, setBackupConfig] = useState(null);
  const [backupConfigError, setBackupConfigError] = useState(null);
  const loadBackupConfig = useCallback(async () => {
    try { setBackupConfig(await apiFetch('/api/admin/backup-config')); } catch (err) { setBackupConfigError(err.message); }
  }, []);
  useEffect(() => { loadBackupConfig(); }, [loadBackupConfig]);

  // EPIC 010 – KI-Trainingsassistent: über die Admin-UI konfigurierbar
  // (statt nur per .env/Neustart wie SMTP). Der API-Key wird vom Backend
  // nie zurückgegeben (nur apiKeySet) – das Feld bleibt beim Laden immer
  // leer, ein leer gelassenes Feld beim Speichern lässt einen bereits
  // gesetzten Key unverändert (siehe adminController.js updateAiConfig).
  const [aiConfig, setAiConfig] = useState(null);
  const [aiApiKeyDraft, setAiApiKeyDraft] = useState('');
  const [aiError, setAiError] = useState(null);
  const [aiSaved, setAiSaved] = useState(false);
  const loadAiConfig = useCallback(async () => {
    try { setAiConfig(await apiFetch('/api/admin/ai-config')); } catch (err) { setAiError(err.message); }
  }, []);
  useEffect(() => { loadAiConfig(); }, [loadAiConfig]);

  const handleSaveAiConfig = async (e) => {
    e.preventDefault();
    setAiError(null);
    setAiSaved(false);
    const body = {
      baseUrl: aiConfig.baseUrl.trim(),
      model: aiConfig.model.trim(),
      timeoutMs: aiConfig.timeoutMs,
    };
    // Nur mitsenden, wenn der Admin tatsächlich etwas eingetippt hat –
    // sonst bliebe ein bereits gesetzter Key sonst versehentlich erhalten
    // oder (bei fälschlich immer mitgesendetem Leerstring) gelöscht.
    if (aiApiKeyDraft !== '') body.apiKey = aiApiKeyDraft;
    try {
      setAiConfig(await apiFetch('/api/admin/ai-config', { method: 'PUT', body: JSON.stringify(body) }));
      setAiApiKeyDraft('');
      setAiSaved(true);
    } catch (err) {
      setAiError(err.message);
    }
  };

  const patchBackupConfig = async (fields) => {
    setBackupConfigError(null);
    const next = { ...backupConfig, ...fields };
    try {
      setBackupConfig(await apiFetch('/api/admin/backup-config', { method: 'PUT', body: JSON.stringify(next) }));
    } catch (err) {
      setBackupConfigError(err.message);
    }
  };

  // Backlog: "kein manueller Backup jetzt ausführen-Endpunkt" – Admins
  // müssen nicht mehr auf den nächsten Zeitplan-Lauf warten (z.B. vor
  // riskanten Wartungsarbeiten).
  const [runningBackup, setRunningBackup] = useState(false);
  const [backupRunResult, setBackupRunResult] = useState(null);
  const handleRunBackupNow = async () => {
    setRunningBackup(true);
    setBackupConfigError(null);
    setBackupRunResult(null);
    try {
      setBackupRunResult(await apiFetch('/api/admin/backup-run', { method: 'POST' }));
    } catch (err) {
      setBackupConfigError(err.message);
    } finally {
      setRunningBackup(false);
    }
  };

  const handleDeleteUser = async (id) => {
    setAdminError(null);
    try {
      await apiFetch(`/api/admin/users/${id}`, { method: 'DELETE' });
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (err) {
      setAdminError(err.message);
    }
  };

  const handleToggleRole = async (u) => {
    setAdminError(null);
    const nextRole = u.role === 'admin' ? 'user' : 'admin';
    try {
      const updated = await apiFetch(`/api/admin/users/${u.id}/role`, {
        method: 'PUT', body: JSON.stringify({ role: nextRole }),
      });
      setUsers((prev) => prev.map((row) => row.id === u.id ? updated : row));
    } catch (err) {
      setAdminError(err.message);
    }
  };

  return (
    <section className={styles.section}>
      <h2>{t('settings.adminTitle')}</h2>
      {adminError && <p className={styles.msgError}><AlertTriangle size={16} aria-hidden="true" /> {adminError}</p>}
      <table className={styles.userTable}>
        <thead>
          <tr><th>{t('settings.colEmail')}</th><th>{t('settings.colRole')}</th><th>{t('settings.colRegistered')}</th><th></th></tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.email}</td>
              <td>{u.role}</td>
              <td>{formatDate(u.created_at)}</td>
              <td className={styles.userActions}>
                {u.id !== user.id && (
                  <>
                    <Button variant="secondary" size="sm" className={styles.smallBtn} onClick={() => handleToggleRole(u)}>
                      {u.role === 'admin' ? t('settings.demoteBtn') : t('settings.promoteBtn')}
                    </Button>
                    <Button variant="danger" size="sm" className={styles.smallBtnDanger} onClick={() => handleDeleteUser(u.id)}>
                      {t('settings.deleteBtn')}
                    </Button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className={styles.subForm}>
        <h3 className={styles.subTitle}>{t('settings.aiAssistantTitle')}</h3>
        <p>
          {aiConfig?.baseUrl
            ? t('settings.aiAssistantActive', { model: aiConfig.model || '–' })
            : t('settings.aiAssistantInactive')}
        </p>
        {aiError && <p className={styles.msgError}><AlertTriangle size={16} aria-hidden="true" /> {aiError}</p>}
        {aiConfig && (
          <form onSubmit={handleSaveAiConfig}>
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="ai-base-url">{t('settings.aiBaseUrlLabel')}</label>
              <input
                id="ai-base-url"
                type="text"
                className={styles.textInput}
                value={aiConfig.baseUrl}
                onChange={(e) => setAiConfig({ ...aiConfig, baseUrl: e.target.value })}
                placeholder={t('settings.aiBaseUrlPlaceholder')}
                maxLength={300}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="ai-model">{t('settings.aiModelLabel')}</label>
              <input
                id="ai-model"
                type="text"
                className={styles.textInput}
                value={aiConfig.model}
                onChange={(e) => setAiConfig({ ...aiConfig, model: e.target.value })}
                placeholder={t('settings.aiModelPlaceholder')}
                maxLength={150}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="ai-api-key">
                {t('settings.aiApiKeyLabel')} {aiConfig.apiKeySet && `(${t('settings.aiApiKeySet')})`}
              </label>
              <input
                id="ai-api-key"
                type="password"
                className={styles.textInput}
                value={aiApiKeyDraft}
                onChange={(e) => setAiApiKeyDraft(e.target.value)}
                placeholder={t('settings.aiApiKeyPlaceholder')}
                maxLength={500}
                autoComplete="off"
              />
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="ai-timeout">{t('settings.aiTimeoutLabel')}</label>
              <input
                id="ai-timeout"
                type="number"
                className={styles.textInput}
                min={1000}
                max={120000}
                step={1000}
                value={aiConfig.timeoutMs}
                onChange={(e) => setAiConfig({ ...aiConfig, timeoutMs: parseInt(e.target.value, 10) || 30000 })}
              />
            </div>

            <Button type="submit" variant="primary" size="md" className={styles.smallBtn}>
              {aiSaved ? <><Check size={16} aria-hidden="true" /> {t('settings.aiSaved')}</> : t('settings.aiSave')}
            </Button>
          </form>
        )}
      </div>

      <div className={styles.subForm}>
        <h3 className={styles.subTitle}>{t('settings.autoBackupsTitle')}</h3>
        {backupConfigError && <p className={styles.msgError}><AlertTriangle size={16} aria-hidden="true" /> {backupConfigError}</p>}
        {backupConfig && (
          <>
            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={!!backupConfig.enabled}
                onChange={(e) => patchBackupConfig({ enabled: e.target.checked })}
              />
              {t('settings.enableBackups')}
            </label>

            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="backup-schedule">{t('settings.schedule')}</label>
              <select
                id="backup-schedule"
                className={styles.select}
                value={backupConfig.schedule}
                onChange={(e) => patchBackupConfig({ schedule: e.target.value })}
              >
                <option value="daily">{t('settings.scheduleDaily')}</option>
                <option value="weekly">{t('settings.scheduleWeekly')}</option>
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="backup-retention">{t('settings.retention')}</label>
              <input
                id="backup-retention"
                type="number"
                className={styles.textInput}
                min={1}
                max={90}
                value={backupConfig.retention}
                onChange={(e) => patchBackupConfig({ retention: parseInt(e.target.value, 10) || 1 })}
              />
            </div>

            <Button
              type="button"
              variant="secondary"
              size="md"
              className={styles.smallBtn}
              onClick={handleRunBackupNow}
              disabled={runningBackup}
            >
              {runningBackup ? t('settings.runningBackupNow') : t('settings.runBackupNow')}
            </Button>
            {backupRunResult && (
              <p className={styles.msgOk}>
                <Check size={16} aria-hidden="true" />{' '}
                {t('settings.backupRunSuccess', {
                  count: backupRunResult.count,
                  timestamp: formatDate(backupRunResult.timestamp, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
                })}
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
