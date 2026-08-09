/**
 * TrainingSessionPage – Editor einer Trainingseinheit (Issue #45):
 * geordnete Liste von Übungen (Board-Referenzen) mit Dauer/Notiz,
 * PDF-Export als druckbarer Trainingsplan.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Trash2, Plus, Ban } from 'lucide-react';
import { useTrainingSessionItems } from '../hooks/useTrainingSessionItems.js';
import { useBoardsApi } from '../hooks/useBoardsApi.js';
import { usePdfExport } from '../hooks/usePdfExport.js';
import { DEFAULT_TEAM_COLORS } from '../constants/fieldConfig.js';
import { teamColorToFillStroke } from '../utils/color.js';
import FieldMiniature from '../components/field/FieldMiniature.jsx';
import BoardPickerModal from '../components/trainings/BoardPickerModal.jsx';
import CommentsPanel from '../components/comments/CommentsPanel.jsx';
import RsvpSection from '../components/rsvp/RsvpSection.jsx';
import Button from '../components/common/Button.jsx';
import styles from './TrainingSessionPage.module.css';

const EXPORT_W = 1280;
const EXPORT_H = 720;

export default function TrainingSessionPage() {
  const { t, i18n } = useTranslation();
  const { id } = useParams();
  const {
    session, items, loading, error,
    fetchSession, updateSession, addItem, updateItem, removeItem, moveItem, canAddItem,
  } = useTrainingSessionItems();
  const { fetchBoard } = useBoardsApi();
  const { exporting, error: exportError, exportPdf } = usePdfExport();

  const [editingName,   setEditingName  ] = useState(false);
  const [name,          setName         ] = useState('');
  const [notes,         setNotes        ] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [goal,          setGoal         ] = useState('');
  const [showPicker,    setShowPicker   ] = useState(false);
  const [adding,        setAdding       ] = useState(false);
  const [pdfError,      setPdfError     ] = useState(null);
  const nameInputRef = useRef(null);

  const load = useCallback(async () => {
    try { await fetchSession(id); } catch { /* error via hook */ }
  }, [fetchSession, id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (session) {
      setName(session.name);
      setNotes(session.notes ?? '');
      setScheduledDate(session.scheduledDate ?? '');
      setGoal(session.goal ?? '');
    }
  }, [session]);

  useEffect(() => {
    if (editingName) nameInputRef.current?.select();
  }, [editingName]);

  const commitName = async () => {
    setEditingName(false);
    const trimmed = name.trim();
    if (!trimmed) { setName(session.name); return; }
    if (trimmed !== session.name) {
      try { await updateSession(id, { name: trimmed }); } catch { /* error via hook */ }
    }
  };

  const commitNotes = async () => {
    if (notes !== (session?.notes ?? '')) {
      try { await updateSession(id, { notes }); } catch { /* error via hook */ }
    }
  };

  const commitScheduledDate = async (value) => {
    setScheduledDate(value);
    if (value !== (session?.scheduledDate ?? '')) {
      try { await updateSession(id, { scheduledDate: value === '' ? null : value }); } catch { /* error via hook */ }
    }
  };

  const commitGoal = async () => {
    if (goal !== (session?.goal ?? '')) {
      try { await updateSession(id, { goal }); } catch { /* error via hook */ }
    }
  };

  const handleAddBoard = async (boardId) => {
    setAdding(true);
    try {
      await addItem(id, { boardId, durationMinutes: 15, note: '' });
      setShowPicker(false);
    } catch { /* error via hook */ } finally {
      setAdding(false);
    }
  };

  const handleExportPdf = async () => {
    setPdfError(null);
    try {
      const frames = [];
      for (const item of items) {
        const board = await fetchBoard(item.boardId);
        const { default: renderFieldFrame } = await import('../components/field/FloorballFieldStatic.js');
        const image = await renderFieldFrame({
          fieldType: board.fieldType,
          width: EXPORT_W,
          height: EXPORT_H,
          players: board.players ?? [],
          elements: board.elements ?? [],
          homeColor: teamColorToFillStroke(board.homeColor, DEFAULT_TEAM_COLORS.home.fill),
          awayColor: teamColorToFillStroke(board.awayColor, DEFAULT_TEAM_COLORS.away.fill),
          ballColor: board.ballColor,
        });
        const noteLine = [
          t('trainings.durationShort', { count: item.durationMinutes }),
          item.note,
        ].filter(Boolean).join(' – ');
        frames.push({ image, note: noteLine });
      }
      await exportPdf({
        boardName: session.name,
        frames,
        framesPerPage: 2,
        paperSize: 'a4',
        language: i18n.language,
      });
    } catch (err) {
      setPdfError(err.message);
    }
  };

  if (loading && !session) {
    return <main className={styles.page} id="main-content"><p>{t('trainings.loadingSession')}</p></main>;
  }
  if (!session) {
    return (
      <main className={styles.page} id="main-content">
        {error && <div className={styles.errorBanner} role="alert"><AlertTriangle size={16} aria-hidden="true" /> {error}</div>}
      </main>
    );
  }

  return (
    <main className={styles.page} id="main-content">
      <header className={styles.header}>
        <Link to="/trainings" className={styles.backLink} aria-label={t('trainings.backToList')}>←</Link>

        {editingName ? (
          <input
            ref={nameInputRef}
            className={styles.nameInput}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter')  commitName();
              if (e.key === 'Escape') { setName(session.name); setEditingName(false); }
            }}
            maxLength={80}
            aria-label={t('trainings.renameAriaLabel')}
          />
        ) : (
          <h1
            className={styles.title}
            onDoubleClick={() => setEditingName(true)}
            title={t('trainings.renameTitle')}
          >
            {session.name}
          </h1>
        )}

        <Button
          variant="primary"
          size="md"
          className={styles.exportBtn}
          onClick={handleExportPdf}
          disabled={exporting || items.length === 0}
          aria-disabled={exporting || items.length === 0}
        >
          {exporting ? t('trainings.exporting') : t('trainings.exportPdf')}
        </Button>
      </header>

      <div className={styles.metaRow}>
        <label className={styles.metaField}>
          {t('trainings.dateLabel')}
          <input
            type="date"
            className={styles.dateInput}
            value={scheduledDate}
            onChange={(e) => commitScheduledDate(e.target.value)}
            aria-label={t('trainings.dateAriaLabel')}
          />
        </label>
        <input
          type="text"
          className={styles.goalInput}
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          onBlur={commitGoal}
          placeholder={t('trainings.goalPlaceholder')}
          maxLength={200}
          aria-label={t('trainings.goalAriaLabel')}
        />
      </div>

      <textarea
        className={styles.notes}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={commitNotes}
        placeholder={t('trainings.notesPlaceholder')}
        maxLength={1000}
        rows={2}
        aria-label={t('trainings.notesAriaLabel')}
      />

      {(error || exportError || pdfError) && (
        <div className={styles.errorBanner} role="alert"><AlertTriangle size={16} aria-hidden="true" /> {error ?? exportError ?? pdfError}</div>
      )}

      {items.length === 0 ? (
        <div className={styles.emptyState} role="status">
          <p>{t('trainings.noItemsYet')}</p>
        </div>
      ) : (
        <ol className={styles.itemList} aria-label={t('trainings.itemListAriaLabel')}>
          {items.map((item, index) => (
            <li key={item._id} className={styles.itemRow}>
              <div className={styles.itemThumb}>
                {item.boardName ? (
                  <FieldMiniature fieldType={item.boardFieldType} theme={item.boardTheme} width={56} height={80} />
                ) : (
                  <span className={styles.itemThumbMissing} aria-hidden="true"><Ban size={20} aria-hidden="true" /></span>
                )}
              </div>

              <div className={styles.itemBody}>
                <span className={styles.itemBoardName}>
                  {item.boardName ?? t('trainings.boardDeleted')}
                </span>
                <div className={styles.itemFields}>
                  <label className={styles.itemField}>
                    {t('trainings.durationLabel')}
                    <input
                      type="number"
                      className={styles.durationInput}
                      value={item.durationMinutes}
                      min={1}
                      max={240}
                      onChange={(e) => updateItem(id, item._id, { durationMinutes: Number(e.target.value) })}
                      aria-label={t('trainings.durationAriaLabel')}
                    />
                  </label>
                  <input
                    type="text"
                    className={styles.noteInput}
                    value={item.note}
                    onChange={(e) => updateItem(id, item._id, { note: e.target.value })}
                    placeholder={t('trainings.itemNotePlaceholder')}
                    maxLength={300}
                    aria-label={t('trainings.itemNoteAriaLabel')}
                  />
                </div>
              </div>

              <div className={styles.itemActions}>
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  onClick={() => moveItem(id, index, -1)}
                  disabled={index === 0}
                  aria-label={t('trainings.moveUp')}
                >▲</Button>
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  onClick={() => moveItem(id, index, 1)}
                  disabled={index === items.length - 1}
                  aria-label={t('trainings.moveDown')}
                >▼</Button>
                <Button
                  variant="danger"
                  size="sm"
                  iconOnly
                  onClick={() => removeItem(id, item._id)}
                  aria-label={t('trainings.removeItemAriaLabel')}
                  title={t('trainings.removeItemTitle')}
                ><Trash2 size={16} aria-hidden="true" /></Button>
              </div>
            </li>
          ))}
        </ol>
      )}

      <Button
        variant="secondary"
        size="md"
        onClick={() => setShowPicker(true)}
        disabled={!canAddItem}
      >
        <Plus size={16} aria-hidden="true" /> {t('trainings.addItem')}
      </Button>

      {showPicker && (
        <BoardPickerModal
          onConfirm={handleAddBoard}
          onClose={() => setShowPicker(false)}
          adding={adding}
        />
      )}

      <RsvpSection resourceKind="trainings" resourceId={id} teamId={session.teamId} />

      <div className={styles.commentsSection}>
        <CommentsPanel resourceKind="trainings" resourceId={id} />
      </div>
    </main>
  );
}
