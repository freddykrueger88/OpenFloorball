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
import { useRoster } from '../hooks/useRoster.js';
import { useLines } from '../hooks/useLines.js';
import { formatDate } from '../utils/formatDate.js';
import useAnnounceStore from '../store/announceStore.js';
import Button from '../components/common/Button.jsx';
import styles from './GamePage.module.css';

export default function GamePage() {
  const { t, i18n } = useTranslation();
  const { id } = useParams();
  const { fetchGame, updateGame } = useGames();
  const { comments: notes, loading: notesLoading, error: notesError, fetchComments, addComment, deleteComment } = useComments('games', id);
  // IFF-Regelwerk 2026: auch Torhüter dürfen inzwischen Tore erzielen –
  // die Zuordnungs-Auswahl (Tor/Strafzeiten/Matchstrafe) filtert Rollen
  // deshalb bewusst NICHT (TW erscheint wie jeder andere Kader-Spieler).
  const { rosterPlayers, fetchRoster } = useRoster();
  // §6 des Lines-Umbaus ("wichtigster Anwendungsfall"): schneller
  // Line-Wechsel direkt während des Spiels, ohne auf /lines wechseln zu
  // müssen. Aktivieren postet zusätzlich eine Notiz über den bereits
  // vorhandenen Preset-Mechanismus (reine Wiederverwendung).
  const { lines, fetchLines, setActive: setLineActive } = useLines();

  const [game,          setGame         ] = useState(null);
  const [gameError,     setGameError    ] = useState(null);
  const [gameLoading,   setGameLoading  ] = useState(true);
  const [editingOpponent, setEditingOpponent] = useState(false);
  const [opponent,      setOpponent     ] = useState('');
  const [playedAt,      setPlayedAt     ] = useState('');
  const [draft,         setDraft        ] = useState('');
  const [sending,        setSending      ] = useState(false);
  // Hält den Basistext des gerade geöffneten Presets (Tor/Strafzeit/
  // Matchstrafe), für das eine Zuordnung (Kader-Spieler oder Gegner)
  // ausgewählt werden kann – null, wenn keine Auswahl offen ist. Immer
  // nur eine Auswahl gleichzeitig offen, statt eines Booleans pro Preset.
  const [openAttributionPreset, setOpenAttributionPreset] = useState(null);
  const opponentInputRef = useRef(null);

  useEffect(() => { fetchRoster().catch(() => {}); }, [fetchRoster]);
  useEffect(() => { fetchLines().catch(() => {}); }, [fetchLines]);

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
  // Notizen (kein Sonderfall). Tor/Strafzeiten/Matchstrafe betreffen
  // immer eine Person – statt eines Sofort-Eintrags öffnen sie die
  // Zuordnungs-Auswahl (Kader-Spieler oder Gegner, siehe unten). Bleiben
  // trotzdem Teil derselben, alphabetisch sortierten Liste (sprachabhängig,
  // daher localeCompare statt fester Reihenfolge).
  const PRESETS = [
    { text: t('games.presetKickoffQ1') },
    { text: t('games.presetKickoffQ2') },
    { text: t('games.presetKickoffQ3') },
    { text: t('games.presetPeriodEnd') },
    { text: t('games.presetTimeout') },
    { text: t('games.presetGoal'), needsAttribution: true },
    { text: t('games.presetPenalty2'), needsAttribution: true },
    { text: t('games.presetPenalty5'), needsAttribution: true },
    { text: t('games.presetMatchPenalty'), needsAttribution: true },
    { text: t('games.presetGameEnd') },
  ].sort((a, b) => a.text.localeCompare(b.text, i18n.language));

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

  // Kader des Spiels: bei team-geteilten Spielen der Kader dieses Teams,
  // sonst der persönliche Kader (teamId=null) – exakt dieselbe
  // Zuordnung wie beim Spiel selbst. Gilt für Tor UND Strafzeiten/
  // Matchstrafe gleichermaßen – eine Strafe kann genauso gut den Gegner
  // treffen wie das eigene Team, daher immer beide Optionen (Kader +
  // "Gegner") statt nur beim Tor.
  const squadForGame = rosterPlayers.filter((p) => (game.teamId ? p.teamId === game.teamId : !p.teamId));
  const linesForGame = lines.filter((l) => (game.teamId ? l.teamId === game.teamId : !l.teamId));

  const handleActivateLine = async (line) => {
    try {
      await setLineActive(line._id, true);
      await handleAddPreset(t('games.lineSwitchNote', { name: line.name }));
    } catch { /* error via hook */ }
  };

  const handleSelectAttribution = (choice) => {
    const base = openAttributionPreset;
    let text = base;
    if (choice === 'opponent') {
      text = `${base} – ${t('games.attributionOpponent')}`;
    } else if (choice) {
      const label = choice.jerseyNumber != null ? `#${choice.jerseyNumber} ${choice.name}` : choice.name;
      text = `${base} – ${label}`;
    }
    handleAddPreset(text);
    setOpenAttributionPreset(null);
  };

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

      {linesForGame.length > 0 && (
        <section className={styles.linesSection} aria-label={t('games.linesAriaLabel')}>
          <div className={styles.linesRow} role="group" aria-label={t('games.linesAriaLabel')}>
            {linesForGame.map((line) => (
              <Button
                key={line._id}
                variant={line.isActive ? 'primary' : 'secondary'}
                size="sm"
                disabled={line.isActive}
                onClick={() => handleActivateLine(line)}
              >
                {line.isActive ? t('games.lineActive', { name: line.name }) : line.name}
              </Button>
            ))}
          </div>
          <Link to="/lines" className={styles.manageLinesLink}>{t('games.manageLines')}</Link>
        </section>
      )}

      <section className={styles.notesSection} aria-label={t('games.notesAriaLabel')}>
        <div className={styles.presetsRow} role="group" aria-label={t('games.presetsAriaLabel')}>
          {PRESETS.map((preset) => (
            <Button
              key={preset.text}
              type="button"
              variant="secondary"
              size="sm"
              aria-expanded={preset.needsAttribution ? openAttributionPreset === preset.text : undefined}
              onClick={() => (preset.needsAttribution
                ? setOpenAttributionPreset((current) => (current === preset.text ? null : preset.text))
                : handleAddPreset(preset.text))}
            >
              {preset.text}
            </Button>
          ))}
        </div>

        {openAttributionPreset && (
          <div className={styles.attributionPicker} role="group" aria-label={t('games.attributionAriaLabel', { event: openAttributionPreset })}>
            {squadForGame.map((player) => (
              <Button
                key={player._id}
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => handleSelectAttribution(player)}
              >
                {player.role && <span className={styles.attributionRole}>{player.role}</span>}
                {player.jerseyNumber != null && `#${player.jerseyNumber} `}{player.name}
              </Button>
            ))}
            <Button type="button" variant="secondary" size="sm" onClick={() => handleSelectAttribution('opponent')}>
              {t('games.attributionOpponent')}
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => handleSelectAttribution(null)}>
              {t('games.attributionNone')}
            </Button>
            {squadForGame.length === 0 && (
              <p className={styles.hint}>{t('games.attributionNoRoster')}</p>
            )}
          </div>
        )}

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
