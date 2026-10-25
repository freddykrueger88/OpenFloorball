/**
 * PublishBoardModal – Bestätigung vor dem Veröffentlichen eines Boards in
 * die Community-Übungsbibliothek (EPIC 010 MVP). Owner-only, ausgelöst aus
 * dem "Info"-Tab des Board-Editors (BoardEditorPage.jsx).
 *
 * Zeigt explizit, was NICHT mitveröffentlicht wird (Notizen, Gegnername) –
 * Transparenz statt Dark Pattern, siehe CLAUDE.md 5.1/5.11.
 */
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Library, AlertTriangle } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap.js';
import { useBoardsApi } from '../../hooks/useBoardsApi.js';
import useAnnounceStore from '../../store/announceStore.js';
import Button from '../common/Button.jsx';
import styles from './PublishBoardModal.module.css';

export default function PublishBoardModal({ boardId, frameId, onClose, onPublished }) {
  const { t } = useTranslation();
  const { loading, error, publishBoard } = useBoardsApi();
  const [done, setDone] = useState(false);
  const containerRef = useRef(null);
  useFocusTrap(containerRef, { onEscape: onClose });

  const handleConfirm = async () => {
    try {
      // Backend nimmt den Snapshot aus genau diesem Frame; ohne frameId
      // (z.B. Aufruf von außerhalb des Editors) fällt es auf Frame 1 zurück.
      const entry = await publishBoard(boardId, frameId ? { frameId } : {});
      setDone(true);
      useAnnounceStore.getState().announce(t('library.publishSuccess'));
      onPublished?.(entry);
    } catch { /* error via hook */ }
  };

  return (
    <div
      ref={containerRef}
      className={styles.backdrop}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="publish-title"
      aria-describedby="publish-msg"
    >
      <div className={styles.dialog}>
        <div className={styles.icon}><Library size={32} aria-hidden="true" /></div>
        <h2 id="publish-title" className={styles.title}>{t('library.publishConfirmTitle')}</h2>
        <p id="publish-msg" className={styles.msg}>{t('library.publishConfirmBody')}</p>

        {error && (
          <p className={styles.errorMsg} role="alert"><AlertTriangle size={16} aria-hidden="true" /> {error}</p>
        )}

        {done ? (
          <p className={styles.successMsg} role="status">{t('library.publishSuccess')}</p>
        ) : (
          <div className={styles.actions}>
            <Button variant="secondary" size="md" className={styles.cancelBtn} onClick={onClose} disabled={loading}>
              {t('dialogs.deleteBoard.cancel')}
            </Button>
            <Button variant="primary" size="md" className={styles.confirmBtn} onClick={handleConfirm} disabled={loading} aria-live="polite">
              {loading ? t('library.publishing') : t('library.publishConfirmAction')}
            </Button>
          </div>
        )}

        {done && (
          <Button variant="secondary" size="md" onClick={onClose}>
            {t('boardShare.close')}
          </Button>
        )}
      </div>
    </div>
  );
}
