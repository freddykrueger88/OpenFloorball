/**
 * DemoDataSection – Verwaltung der Demo-Testumgebung (Onboarding-Ausbau).
 * Zeigt an, ob Demo-Daten vorhanden sind, und erlaubt sicheres Anlegen/
 * Löschen – ausschließlich is_demo=true-Daten des eigenen Accounts, siehe
 * backend/src/services/demoData.js.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, Trash2 } from 'lucide-react';
import { useDemoData } from '../../hooks/useDemoData.js';
import useAnnounceStore from '../../store/announceStore.js';
import Button from '../common/Button.jsx';
import DemoDataDeleteDialog from './DemoDataDeleteDialog.jsx';
import styles from '../../pages/SettingsPage.module.css';

export default function DemoDataSection() {
  const { t, i18n } = useTranslation();
  const { status, loading, error, createDemoData, deleteDemoData } = useDemoData();

  const [creating, setCreating] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);

  const handleCreate = async () => {
    setCreating(true);
    setSuccessMsg(null);
    try {
      await createDemoData();
      useAnnounceStore.getState().announce(t('settings.demoData.createSuccess'));
      setSuccessMsg(t('settings.demoData.createSuccess'));
    } catch { /* error via hook */ } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteDemoData();
      useAnnounceStore.getState().announce(t('settings.demoData.deleteSuccess'));
      setSuccessMsg(t('settings.demoData.deleteSuccess'));
      setShowDelete(false);
    } catch { /* error via hook, shown in dialog */ } finally {
      setDeleting(false);
    }
  };

  if (loading) return <section className={styles.section}><h2>{t('settings.nav.demoData')}</h2></section>;

  return (
    <section className={styles.section}>
      <h2>{t('settings.nav.demoData')}</h2>

      {status?.hasDemoData ? (
        <div className={styles.field}>
          <p className={styles.hint}>{t('settings.demoData.activeHint')}</p>
          <p className={styles.currentValue}>
            {t('settings.demoData.seededAt', {
              date: status.seededAt ? new Date(status.seededAt).toLocaleDateString(i18n.language) : '',
            })}
          </p>
          <div className={styles.dangerZone}>
            <h3 className={styles.subTitle}>{t('settings.demoData.deleteTitle')}</h3>
            <p className={styles.hint}>{t('settings.demoData.deleteHint')}</p>
            <Button variant="danger" size="md" onClick={() => setShowDelete(true)}>
              <Trash2 size={16} aria-hidden="true" /> {t('settings.demoData.deleteBtn')}
            </Button>
          </div>
        </div>
      ) : (
        <div className={styles.field}>
          <p className={styles.hint}>{t('settings.demoData.inactiveHint')}</p>
          <Button variant="primary" size="md" className={styles.submitBtn} onClick={handleCreate} disabled={creating}>
            {creating ? t('settings.demoData.creating') : <><Sparkles size={16} aria-hidden="true" /> {t('settings.demoData.createBtn')}</>}
          </Button>
        </div>
      )}

      {error && <p className={styles.msgError}>{error}</p>}
      {successMsg && <p className={styles.msgOk}>{successMsg}</p>}

      {showDelete && (
        <DemoDataDeleteDialog
          onConfirm={handleDelete}
          onCancel={() => setShowDelete(false)}
          loading={deleting}
          error={null}
        />
      )}
    </section>
  );
}
