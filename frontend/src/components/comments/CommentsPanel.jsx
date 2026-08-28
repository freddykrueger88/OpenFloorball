/**
 * CommentsPanel – Kommentare auf Boards und Trainingseinheiten (ROADMAP
 * Phase 2). Generisch über resourceKind ('boards' | 'trainings') +
 * resourceId, siehe useComments.js. Bearbeiten/Löschen nur für den
 * eigenen Kommentar – Moderation durch Ressourcen-Owner ist serverseitig
 * bereits möglich (siehe commentsController.deleteComment), aber
 * bewusst (noch) ohne eigene UI in diesem ersten Wurf.
 *
 * externalState (Layer-System, CLAUDE.md §10.2): optional – der
 * Board-Editor hält seinen eigenen useComments()-Stand, weil
 * CommentPinsLayer.jsx dieselben Kommentare auf dem Feld braucht. Wird
 * externalState übergeben, verwendet dieses Panel dessen Daten/Aktionen
 * statt einer eigenen, zweiten fetch()-Instanz – Trainings-/Spiel-
 * Kommentare (kein externalState) verhalten sich unverändert wie zuvor.
 * highlightedCommentId hebt einen per Pin-Klick ausgewählten Kommentar
 * in der Liste hervor.
 */
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import useAuthStore from '../../store/authStore.js';
import { useComments } from '../../hooks/useComments.js';
import { formatDate } from '../../utils/formatDate.js';
import Button from '../common/Button.jsx';
import styles from './CommentsPanel.module.css';

const MAX_LENGTH = 2000;

export default function CommentsPanel({ resourceKind, resourceId, externalState, highlightedCommentId }) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const internalState = useComments(resourceKind, resourceId);
  const { comments, loading, error, fetchComments, addComment, updateComment, deleteComment } = externalState ?? internalState;

  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState('');
  const highlightedRef = useRef(null);

  // Nur selbst fetchen, wenn kein externalState mitgegeben wurde – sonst
  // holt/verwaltet der Aufrufer (BoardEditorPage.jsx) die Daten bereits
  // selbst, ein zweiter GET wäre unnötig.
  useEffect(() => { if (!externalState) fetchComments().catch(() => {}); }, [fetchComments, externalState]);

  useEffect(() => {
    if (highlightedCommentId && highlightedRef.current) {
      highlightedRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightedCommentId]);

  const handleAdd = async (e) => {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    try {
      await addComment(trimmed);
      setDraft('');
    } catch { /* error via hook */ }
  };

  const startEdit = (comment) => {
    setEditingId(comment._id);
    setEditDraft(comment.text);
  };

  const commitEdit = async (commentId) => {
    const trimmed = editDraft.trim();
    if (!trimmed) return;
    try {
      await updateComment(commentId, trimmed);
      setEditingId(null);
    } catch { /* error via hook */ }
  };

  return (
    <section className={styles.panel} aria-label={t('comments.ariaLabel')}>
      <h3 className={styles.heading}>{t('comments.title')}</h3>

      {error && <p className={styles.msgError}><AlertTriangle size={16} aria-hidden="true" /> {error}</p>}

      {loading && comments.length === 0 ? (
        <p className={styles.hint}>{t('comments.loading')}</p>
      ) : comments.length === 0 ? (
        <p className={styles.hint}>{t('comments.empty')}</p>
      ) : (
        <ul className={styles.list} role="list">
          {comments.map((c) => (
            <li
              key={c._id}
              ref={c._id === highlightedCommentId ? highlightedRef : undefined}
              className={`${styles.item} ${c._id === highlightedCommentId ? styles.highlighted : ''}`}
            >
              <div className={styles.itemHeader}>
                <span className={styles.author}>{c.email}</span>
                <span className={styles.timestamp}>{formatDate(c.createdAt, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              </div>

              {editingId === c._id ? (
                <div className={styles.editRow}>
                  <textarea
                    className={styles.textarea}
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    maxLength={MAX_LENGTH}
                    rows={2}
                    aria-label={t('comments.editAriaLabel')}
                  />
                  <div className={styles.editActions}>
                    <Button variant="secondary" size="sm" className={styles.smallBtn} onClick={() => commitEdit(c._id)}>{t('comments.saveBtn')}</Button>
                    <Button variant="secondary" size="sm" className={styles.smallBtn} onClick={() => setEditingId(null)}>{t('comments.cancelBtn')}</Button>
                  </div>
                </div>
              ) : (
                <p className={styles.text}>{c.text}</p>
              )}

              {c.userId === user?.id && editingId !== c._id && (
                <div className={styles.itemActions}>
                  <Button variant="secondary" size="sm" className={styles.smallBtn} onClick={() => startEdit(c)} aria-label={t('comments.editAriaLabel')}>
                    {t('comments.editBtn')}
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => deleteComment(c._id)} aria-label={t('comments.deleteAriaLabel')}>
                    {t('comments.deleteBtn')}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <form className={styles.addForm} onSubmit={handleAdd}>
        <textarea
          className={styles.textarea}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t('comments.placeholder')}
          maxLength={MAX_LENGTH}
          rows={2}
          aria-label={t('comments.placeholder')}
        />
        <Button type="submit" variant="primary" size="md" className={styles.submitBtn} disabled={!draft.trim()}>
          {t('comments.addBtn')}
        </Button>
      </form>
    </section>
  );
}
