/**
 * GamePage – Live-Spielnotizen für ein einzelnes Spiel (Backlog
 * "Erweiterung: Live-Unterstützung"). Kopf mit Gegner+Datum
 * (editierbar wie in TrainingSessionPage.jsx), darunter eine auf
 * schnelle Eingabe während des laufenden Spiels zugeschnittene
 * Notizen-Liste.
 *
 * Die Notizen selbst sind KEINE eigene Ressource – sie laufen über
 * die bestehende comments-Tabelle (resource_type='game', siehe
 * gamesController.js) und damit über den bereits vorhandenen,
 * generischen useComments-Hook (kein neuer Notizen-Hook nötig).
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Trash2, Send } from 'lucide-react';
import { useGames } from '../hooks/useGames.js';
import { useComments } from '../hooks/useComments.js';
import { formatDate } from '../utils/formatDate.js';
import useAnnounceStore from '../store/announceStore.js';
import Button from '../components/common/Button.jsx';
import styles from './GamePage.module.css';

export default function GamePage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const { fetchGame, updateGame } = useGames();
  const { comments: notes, loading: notesLoading, error: notesError, fetchComments, addComment, deleteComment } = useComments('games', id);

  const [game,          setGame         ] = useState(null);
  const [gameError,     setGameError    ] = useState(null);
  const [gameLoading,   setGameLoading  ] = useState(true);
  const [editingOpponent, setEditingOpponent] = useState(false);
  const [opponent,      setOpponent     ] = useState('');
  const [playedAt,      setPlayedAt     ] = useState('');
  const [draft,         setDraft        ] = useState('');
  const [sending,        setSending      ] = useState(false);
  const opponentInputRef = useRef(null);

  const load = useCallback(async () => {
    setGameLoading(true);
    try {
      const loaded = await fetchGame(id);
      setGame(loaded);
      setOpponent(loaded.opponent);
      setPlayedAt(loaded.playedAt ?? '');
    } catch (err) {
      setGameError(err.message);
    } finally {
      setGameLoading(false);
    }
  }, [fetchGame, id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { fetchComments().catch(() => {}); }, [fetchComments]);

  useEffect(() => {
    if (editingOpponent) opponentInputRef.current?.select();
  }, [editingOpponent]);

  const commitOpponent = async () => {
    setEditingOpponent(false);
    const trimmed = opponent.trim();
    if (trimmed === game.opponent) return;
    try {
      const updated = await updateGame(id, { opponent: trimmed }, {
        baselineUpdatedAt: game.updatedAt, label: game.opponent || t('games.noOpponent'),
      });
      setGame(updated);
    } catch {
      setOpponent(game.opponent);
    }
  };

  const commitPlayedAt = async (value) => {
    setPlayedAt(value);
    try {
      const updated = await updateGame(id, { playedAt: value === '' ? null : value }, {
        baselineUpdatedAt: game.updatedAt, label: game.opponent || t('games.noOpponent'),
      });
      setGame(updated);
    } catch {
      setPlayedAt(game.playedAt ?? '');
    }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    setSending(true);
    try {
      await addComment(trimmed);
      setDraft('');
      useAnnounceStore.getState().announce(t('games.noteAddedAnnouncement'));
    } catch {
      // Fehler über notesError, Text bleibt bewusst im Feld stehen (nicht
      // verloren) – z.B. bei einem Netzwerkabbruch in der Halle.
    } finally {
      setSending(false);
    }
  };

  // Feste Ereignisse aus dem IFF-Regelwerk (3 Drittel à 20 Min., eine
  // Auszeit/Team, Strafzeiten 2/5 Min./Matchstrafe) – ein Tap trägt die
  // Notiz direkt ein, ohne erst ins Eingabefeld tippen zu müssen. Fehler
  // laufen über dieselbe notesError-Anzeige wie bei frei eingegebenen
  // Notizen (kein Sonderfall).
  const PRESETS = [
    t('games.presetKickoffQ1'), t('games.presetKickoffQ2'), t('games.presetKickoffQ3'),
    t('games.presetPeriodEnd'), t('games.presetTimeout'), t('games.presetGoal'),
    t('games.presetPenalty2'), t('games.presetPenalty5'), t('games.presetMatchPenalty'),
    t('games.presetGameEnd'),
  ];

  const handleAddPreset = async (text) => {
    try {
      await addComment(text);
      useAnnounceStore.getState().announce(t('games.noteAddedAnnouncement'));
    } catch {
      // Fehler über notesError – Ereignis einfach erneut antippen.
    }
  };

  if (gameLoading && !game) {
    return <main className={styles.page} id="main-content"><p>{t('games.loadingGame')}</p></main>;
  }
  if (!game) {
    return (
      <main className={styles.page} id="main-content">
        {gameError && <div className={styles.errorBanner} role="alert"><AlertTriangle size={16} aria-hidden="true" /> {gameError}</div>}
      </main>
    );
  }

  const notesNewestFirst = [...notes].reverse();

  return (
    <main className={styles.page} id="main-content">
      <header className={styles.header}>
        <Link to="/games" className={styles.backLink} aria-label={t('games.backToList')}>←</Link>

        {editingOpponent ? (
          <input
            ref={opponentInputRef}
            className={styles.nameInput}
            value={opponent}
            onChange={(e) => setOpponent(e.target.value)}
            onBlur={commitOpponent}
            onKeyDown={(e) => {
              if (e.key === 'Enter')  commitOpponent();
              if (e.key === 'Escape') { setOpponent(game.opponent); setEditingOpponent(false); }
            }}
            maxLength={100}
            aria-label={t('games.renameAriaLabel')}
          />
        ) : (
          <h1
            className={styles.title}
            onDoubleClick={() => setEditingOpponent(true)}
            title={t('games.renameTitle')}
          >
            {game.opponent || t('games.noOpponent')}
          </h1>
        )}

        <label className={styles.dateField}>
          {t('games.dateLabel')}
          <input
            type="date"
            className={styles.dateInput}
            value={playedAt}
            onChange={(e) => commitPlayedAt(e.target.value)}
            aria-label={t('games.dateAriaLabel')}
          />
        </label>
      </header>

      {(gameError || notesError) && (
        <div className={styles.errorBanner} role="alert"><AlertTriangle size={16} aria-hidden="true" /> {gameError ?? notesError}</div>
      )}

      <section className={styles.notesSection} aria-label={t('games.notesAriaLabel')}>
        <div className={styles.presetsRow} role="group" aria-label={t('games.presetsAriaLabel')}>
          {PRESETS.map((text) => (
            <Button key={text} type="button" variant="secondary" size="sm" onClick={() => handleAddPreset(text)}>
              {text}
            </Button>
          ))}
        </div>

        <form className={styles.addForm} onSubmit={handleAddNote}>
          <input
            autoFocus
            className={styles.addInput}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t('games.notePlaceholder')}
            maxLength={2000}
            aria-label={t('games.noteAriaLabel')}
          />
          <Button type="submit" variant="primary" size="md" disabled={sending || !draft.trim()}>
            <Send size={16} aria-hidden="true" /> {t('games.addNote')}
          </Button>
        </form>

        {notesLoading && notes.length === 0 ? (
          <p className={styles.hint}>{t('games.loadingNotes')}</p>
        ) : notesNewestFirst.length === 0 ? (
          <p className={styles.hint}>{t('games.noNotesYet')}</p>
        ) : (
          <ul className={styles.notesList} role="list">
            {notesNewestFirst.map((note) => (
              <li key={note._id} className={styles.noteItem}>
                <span className={styles.noteTime}>
                  {formatDate(note.createdAt, { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className={styles.noteText}>{note.text}</span>
                {game.teamId && <span className={styles.noteAuthor}>{note.email}</span>}
                <Button
                  variant="danger"
                  size="sm"
                  iconOnly
                  className={styles.noteDeleteBtn}
                  onClick={() => deleteComment(note._id)}
                  aria-label={t('games.deleteNoteAriaLabel')}
                >
                  <Trash2 size={16} aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
