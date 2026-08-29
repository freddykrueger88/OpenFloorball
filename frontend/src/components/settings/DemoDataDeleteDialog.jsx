/**
 * DemoDataDeleteDialog – Sicherheitsabfrage zum Löschen der Demo-
 * Testumgebung (Onboarding-Ausbau). Einstufig (anders als
 * DeleteAccountDialog.jsx) statt mehrstufig, da reversibel: die
 * Demo-Umgebung lässt sich jederzeit über "Demo-Daten erneut erstellen"
 * neu anlegen. Verlangt trotzdem eine exakte Texteingabe, da das Ergebnis
 * (mehrere Tabellen, Team+Kader+Spiele+Trainings) nicht trivial ist.
 */
import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap.js';
import Button from '../common/Button.jsx';
import styles from '../boards/DeleteConfirmDialog.module.css';

const CONFIRM_PHRASE = 'DEMO LÖSCHEN';

export default function DemoDataDeleteDialog({ onConfirm, onCancel, loading, error }) {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const containerRef = useRef(null);
  useFocusTrap(containerRef, { onEscape: onCancel });

  const matches = input.trim().toUpperCase() === CONFIRM_PHRASE;

  return (
    <div
      ref={containerRef}
      className={styles.backdrop}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="del-demo-title"
      aria-describedby="del-demo-msg"
    >
      <div className={`${styles.dialog} ${styles.danger}`}>
        <div className={styles.icon} aria-hidden="true"><AlertTriangle size={32} aria-hidden="true" /></div>
        <h2 id="del-demo-title" className={styles.title}>{t('dialogs.deleteDemoData.title')}</h2>
        <p id="del-demo-msg" className={styles.msg}>{t('dialogs.deleteDemoData.message')}</p>
        <p className={styles.msg}>{t('dialogs.deleteDemoData.realDataSafe')}</p>

        <label style={{ width: '100%', textAlign: 'left' }}>
          <span className={styles.msg} style={{ display: 'block', marginBottom: 'var(--space-2)' }}>
            {t('dialogs.deleteDemoData.confirmLabel', { phrase: CONFIRM_PHRASE })}
          </span>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={CONFIRM_PHRASE}
            autoComplete="off"
            style={{
              width: '100%', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)', background: 'var(--color-bg)',
              color: 'var(--color-text)', fontSize: 'var(--text-sm)',
            }}
          />
        </label>
        {error && <p className={styles.msg} style={{ color: 'var(--color-error)' }}><AlertTriangle size={16} aria-hidden="true" /> {error}</p>}

        <div className={styles.actions}>
          <Button variant="secondary" size="md" className={styles.cancelBtn} onClick={onCancel} disabled={loading}>
            {t('dialogs.deleteDemoData.cancel')}
          </Button>
          <Button
            variant="danger"
            size="md"
            className={styles.confirmBtn}
            onClick={onConfirm}
            disabled={loading || !matches}
            aria-live="polite"
          >
            {loading ? t('dialogs.deleteDemoData.deleting') : t('dialogs.deleteDemoData.confirm')}
          </Button>
        </div>
      </div>
    </div>
  );
}
