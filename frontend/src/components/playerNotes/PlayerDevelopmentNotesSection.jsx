/**
 * PlayerDevelopmentNotesSection – freie Beobachtungsnotizen zu einem
 * Kader-Spieler (Statistik-Architektur Phase 5, CLAUDE.md-Vision
 * "Spielerentwicklung langfristig begleiten"). Struktur analog
 * CommentsPanel.jsx: Bearbeiten/Löschen nur für die eigene Notiz –
 * Owner-Moderation ist serverseitig bereits möglich (siehe
 * playerDevelopmentNotesController.deleteNote), aber bewusst (noch)
 * ohne eigene UI, exakt wie bei CommentsPanel.jsx dokumentiert.
 *
 * Backend liefert 404, wenn der Nutzer keine coach/owner-Berechtigung
 * für diesen Kader-Spieler hat (nie 'member') – in diesem Fall blendet
 * die Sektion sich komplett aus, statt eine Fehlermeldung zu zeigen.
 */
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import useAuthStore from '../../store/authStore.js';
import { usePlayerDevelopmentNotes } from '../../hooks/usePlayerDevelopmentNotes.js';
import { formatDate } from '../../utils/formatDate.js';
import Button from '../common/Button.jsx';
import styles from './PlayerDevelopmentNotesSection.module.css';

const MAX_LENGTH = 2000;

export default function PlayerDevelopmentNotesSection({ playerId }) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { notes, loading, error, fetchNotes, addNote, editNote, removeNote } = usePlayerDevelopmentNotes(playerId);

  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState('');
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    fetchNotes().catch((err) => {
      if (err?.status === 404) setForbidden(true);
    });
  }, [fetchNotes]);

  if (forbidden) return null;

  const handleAdd = async (e) => {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    try {
      await addNote(trimmed);
      setDraft('');
    } catch { /* error via hook */ }
  };

  const startEdit = (note) => {
    setEditingId(note._id);
    setEditDraft(note.note);
  };

  const commitEdit = async (noteId) => {
    const trimmed = editDraft.trim();
    if (!trimmed) return;
    try {
      await editNote(noteId, trimmed);
      setEditingId(null);
    } catch { /* error via hook */ }
  };

  return (
    <section className={styles.panel} aria-label={t('playerNotes.ariaLabel')}>
      <h3 className={styles.heading}>{t('playerNotes.title')}</h3>

      {error && <p className={styles.msgError}><AlertTriangle size={16} aria-hidden="true" /> {error}</p>}

      {loading && notes.length === 0 ? (
        <p className={styles.hint}>{t('playerNotes.loading')}</p>
      ) : notes.length === 0 ? (
        <p className={styles.hint}>{t('playerNotes.empty')}</p>
      ) : (
        <ul className={styles.list} role="list">
          {notes.map((n) => (
            <li key={n._id} className={styles.item}>
              <div className={styles.itemHeader}>
                <span className={styles.author}>{n.authorName}</span>
                <span className={styles.timestamp}>{formatDate(n.createdAt, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              </div>

              {editingId === n._id ? (
                <div className={styles.editRow}>
                  <textarea
                    className={styles.textarea}
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    maxLength={MAX_LENGTH}
                    rows={3}
                    aria-label={t('playerNotes.editAriaLabel')}
                  />
                  <div className={styles.editActions}>
                    <Button variant="secondary" size="sm" className={styles.smallBtn} onClick={() => commitEdit(n._id)}>{t('playerNotes.saveBtn')}</Button>
                    <Button variant="secondary" size="sm" className={styles.smallBtn} onClick={() => setEditingId(null)}>{t('playerNotes.cancelBtn')}</Button>
                  </div>
                </div>
              ) : (
                <p className={styles.text}>{n.note}</p>
              )}

              {n.authorUserId === user?.id && editingId !== n._id && (
                <div className={styles.itemActions}>
                  <Button variant="secondary" size="sm" className={styles.smallBtn} onClick={() => startEdit(n)} aria-label={t('playerNotes.editAriaLabel')}>
                    {t('playerNotes.editBtn')}
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => removeNote(n._id).catch(() => {})} aria-label={t('playerNotes.deleteAriaLabel')}>
                    {t('playerNotes.deleteBtn')}
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
          placeholder={t('playerNotes.placeholder')}
          maxLength={MAX_LENGTH}
          rows={3}
          aria-label={t('playerNotes.placeholder')}
        />
        <Button type="submit" variant="primary" size="md" className={styles.submitBtn} disabled={!draft.trim()}>
          {t('playerNotes.addBtn')}
        </Button>
      </form>
    </section>
  );
}
