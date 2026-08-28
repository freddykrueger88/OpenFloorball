/**
 * AddCommentPinDialog – Text erfassen für einen neuen Kommentar-Pin
 * (Layer-System, CLAUDE.md §10.2). Erscheint nach einem Klick mit dem
 * 'comment'-Werkzeug auf das Feld (siehe BoardEditorPage.jsx); die
 * Position selbst steht zu diesem Zeitpunkt schon fest und wird nur
 * durchgereicht – dieser Dialog erfasst ausschließlich den Text.
 */
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFocusTrap } from '../../hooks/useFocusTrap.js';
import { MessageCircle } from 'lucide-react';
import Button from '../common/Button.jsx';
import styles from './AddCommentPinDialog.module.css';

const MAX_LENGTH = 2000;

export default function AddCommentPinDialog({ onSave, onCancel, saving }) {
  const { t } = useTranslation();
  const containerRef = useRef(null);
  const [text, setText] = useState('');
  useFocusTrap(containerRef, { onEscape: onCancel });

  const trimmed = text.trim();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!trimmed) return;
    onSave(trimmed);
  };

  return (
    <div
      ref={containerRef}
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="comment-pin-title"
    >
      <form className={styles.dialog} onSubmit={handleSubmit}>
        <div className={styles.icon} aria-hidden="true"><MessageCircle size={32} aria-hidden="true" /></div>
        <h2 id="comment-pin-title" className={styles.title}>{t('comments.pinDialogTitle')}</h2>
        <textarea
          className={styles.pinTextarea}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('comments.placeholder')}
          maxLength={MAX_LENGTH}
          rows={3}
          autoFocus
          aria-label={t('comments.pinDialogTitle')}
        />

        <div className={styles.actions}>
          <Button type="button" variant="secondary" size="md" className={styles.cancelBtn} onClick={onCancel} disabled={saving}>
            {t('comments.cancelBtn')}
          </Button>
          <Button type="submit" variant="primary" size="md" className={styles.confirmBtn} disabled={saving || !trimmed}>
            {saving ? t('comments.pinDialogSaving') : t('comments.pinDialogSave')}
          </Button>
        </div>
      </form>
    </div>
  );
}
