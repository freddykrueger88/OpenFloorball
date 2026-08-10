/**
 * GamePage – Live-Spielnotizen für ein einzelnes Spiel (Backlog
 * "Erweiterung: Live-Unterstützung"). Kopf mit Gegner+Datum
 * (editierbar wie in TrainingSessionPage.jsx), darunter eine auf
 * schnelle Eingabe während des laufenden Spiels zugeschnittene
 * Notizen-Liste.
 *
 * Roadmap-Audit "Live-Match-Ereignisse" (Start Phase C): die 10 festen
 * IFF-Presets (Anstoß Q1-3, Drittelende, Auszeit, Tor, Strafen,
 * Spielende) laufen jetzt über die strukturierte game_events-Tabelle
 * (useGameEvents.js) statt über Freitext-Kommentare – macht spätere
 * Auswertung (Tore/Spieler, Strafminuten) möglich, ohne Text zu
 * parsen. Freitext-Notizen und die Line-Wechsel-Notiz gehören NICHT
 * zum festen Ereignis-Vokabular und laufen weiterhin über die
 * bestehende comments-Tabelle (resource_type='game', siehe
 * gamesController.js) via useComments.js. Beide Quellen werden für
 * die Anzeige zu einer einzigen, chronologisch sortierten Zeitleiste
 * zusammengeführt (siehe timelineItems unten).
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Trash2, Send, FileDown, Play, Pause, SkipForward, RotateCcw } from 'lucide-react';
import { useGames } from '../hooks/useGames.js';
import { useComments } from '../hooks/useComments.js';
import { useGameEvents } from '../hooks/useGameEvents.js';
import { useRoster } from '../hooks/useRoster.js';
import { useLines } from '../hooks/useLines.js';
import { usePdfExport } from '../hooks/usePdfExport.js';
import { useGameClock } from '../hooks/useGameClock.js';
import { useGameClockSync } from '../hooks/useGameClockSync.js';
import { formatDate } from '../utils/formatDate.js';
import useAnnounceStore from '../store/announceStore.js';
import RsvpSection from '../components/rsvp/RsvpSection.jsx';
import MatchSquadSection from '../components/matchSquad/MatchSquadSection.jsx';
import Button from '../components/common/Button.jsx';
import styles from './GamePage.module.css';

export default function GamePage() {
  const { t, i18n } = useTranslation();
  const { id } = useParams();
  const { fetchGame, updateGame } = useGames();
  const { exporting: exportingReport, error: reportError, exportGameReport } = usePdfExport();
  const { comments: notes, loading: notesLoading, error: notesError, fetchComments, addComment, deleteComment } = useComments('games', id);
  const { events, loading: eventsLoading, error: eventsError, fetchEvents, addEvent, deleteEvent } = useGameEvents(id);
  const { error: clockError, start: startClock, pause: pauseClock, nextPeriod: nextClockPeriod, reset: resetClock } = useGameClock();
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
  // Spieluhr (Roadmap-Audit): tickt nur zur Anzeige, während die Uhr
  // läuft – der Server kennt nur Start-/Pausepunkte, die Restzeit wird
  // rein clientseitig aus clockElapsedSeconds/clockStartedAt berechnet.
  const [now, setNow] = useState(() => Date.now());
  const opponentInputRef = useRef(null);

  const { pingClockUpdate } = useGameClockSync(id, {
    onClockUpdate: (clockState) => setGame((prev) => prev ? { ...prev, ...clockState } : prev),
  });

  useEffect(() => { fetchRoster().catch(() => {}); }, [fetchRoster]);
  useEffect(() => { fetchLines().catch(() => {}); }, [fetchLines]);

  useEffect(() => {
    if (game?.clockStatus !== 'running') return undefined;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [game?.clockStatus]);

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
  useEffect(() => { fetchEvents().catch(() => {}); }, [fetchEvents]);

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

  const handleExportReport = () => {
    exportGameReport({ gameId: id, language: i18n.language }).catch(() => {});
  };

  const commitPeriodMinutes = async (value) => {
    const minutes = Number(value);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 60) return;
    try {
      const updated = await updateGame(id, { periodMinutes: minutes });
      setGame(updated);
    } catch { /* error via hook */ }
  };

  // Nach jeder eigenen Aktion: eigenen State direkt aus der REST-Antwort
  // aktualisieren (Server bleibt Autorität), bei einem neu protokollierten
  // Anstoß-/Drittelende-Event die Zeitleiste neu laden, und andere offene
  // Geräte/Tabs per WS-Ping informieren (siehe useGameClockSync.js).
  const handleClockAction = async (action) => {
    try {
      const result = await action(id);
      setGame((prev) => prev ? { ...prev, ...result } : prev);
      if (result.createdEvent) fetchEvents().catch(() => {});
      pingClockUpdate();
    } catch { /* error via hook */ }
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
    { type: 'kickoff_q1',    text: t('games.presetKickoffQ1') },
    { type: 'kickoff_q2',    text: t('games.presetKickoffQ2') },
    { type: 'kickoff_q3',    text: t('games.presetKickoffQ3') },
    { type: 'period_end',    text: t('games.presetPeriodEnd') },
    { type: 'timeout',       text: t('games.presetTimeout') },
    { type: 'goal',          text: t('games.presetGoal'), needsAttribution: true },
    { type: 'penalty_2',     text: t('games.presetPenalty2'), needsAttribution: true },
    { type: 'penalty_5',     text: t('games.presetPenalty5'), needsAttribution: true },
    { type: 'match_penalty', text: t('games.presetMatchPenalty'), needsAttribution: true },
    { type: 'game_end',      text: t('games.presetGameEnd') },
  ].sort((a, b) => a.text.localeCompare(b.text, i18n.language));

  const handleAddPreset = async (eventType, attribution = {}) => {
    try {
      await addEvent({ eventType, ...attribution });
      useAnnounceStore.getState().announce(t('games.noteAddedAnnouncement'));
    } catch {
      // Fehler über eventsError – Ereignis einfach erneut antippen.
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

  // Live-Spielstand (Phase C): rein abgeleitet aus den bereits
  // strukturierten Tor-Ereignissen, kein eigenes Score-Feld auf `games`
  // nötig. "Ohne Angabe" bei der Zuordnung zählt als eigenes Tor (nur
  // "Gegner" ist explizit als isOpponent markiert, siehe PRESETS/
  // handleSelectAttribution oben). Bewusst client-seitig für die
  // optimistische Live-Anzeige nachgebaut statt einen Server-Roundtrip
  // abzuwarten – die kanonische, identische Berechnung liegt zentral in
  // backend/src/services/statisticsEngine.js (calculateMatchScore),
  // z.B. für den PDF-Spielbericht (siehe ADR-0001/Statistik-Architektur-
  // Dokument, Abschnitt 10).
  const ownGoals      = events.filter((e) => e.eventType === 'goal' && !e.isOpponent).length;
  const opponentGoals = events.filter((e) => e.eventType === 'goal' && e.isOpponent).length;

  // Spieluhr: Restzeit rein clientseitig berechnet (Pause-Resume-Modell
  // ohne Server-Tick, siehe gameClockController.js). Kein Auto-Stopp bei
  // 0:00 – auf 0 geclampt statt negativ, der Coach pausiert manuell.
  const periodSeconds = (game.clockPeriodMinutes ?? 20) * 60;
  const runningSeconds = game.clockStatus === 'running' && game.clockStartedAt
    ? Math.floor((now - new Date(game.clockStartedAt).getTime()) / 1000)
    : 0;
  const remainingSeconds = Math.max(0, periodSeconds - (game.clockElapsedSeconds ?? 0) - runningSeconds);
  const clockMM = String(Math.floor(remainingSeconds / 60)).padStart(2, '0');
  const clockSS = String(remainingSeconds % 60).padStart(2, '0');

  // Line-Wechsel ist kein festes IFF-Ereignis (kein Eintrag in PRESETS) –
  // bleibt bewusst eine Freitext-Notiz über comments, wie vor dem
  // Ereignisse-Umbau.
  const handleActivateLine = async (line) => {
    try {
      await setLineActive(line._id, true);
      await addComment(t('games.lineSwitchNote', { name: line.name }));
      useAnnounceStore.getState().announce(t('games.noteAddedAnnouncement'));
    } catch { /* error via hook */ }
  };

  const handleSelectAttribution = (choice) => {
    const eventType = openAttributionPreset;
    if (choice === 'opponent') {
      handleAddPreset(eventType, { isOpponent: true });
    } else if (choice) {
      handleAddPreset(eventType, { rosterPlayerId: choice._id });
    } else {
      handleAddPreset(eventType, {});
    }
    setOpenAttributionPreset(null);
  };

  // Rekonstruiert das Anzeige-Label eines Ereignisses zur Anzeigezeit aus
  // eventType + Zuordnung, statt es (wie früher) als fertigen String zu
  // speichern – dadurch zeigt ein vor einem Sprachwechsel erfasstes
  // Ereignis danach automatisch das neue Sprachlabel.
  const eventLabel = (evt) => {
    const preset = PRESETS.find((p) => p.type === evt.eventType);
    const base = preset?.text ?? evt.eventType;
    if (evt.isOpponent) return `${base} – ${t('games.attributionOpponent')}`;
    if (evt.rosterPlayerId) {
      const player = squadForGame.find((p) => p._id === evt.rosterPlayerId);
      if (player) {
        const label = player.jerseyNumber != null ? `#${player.jerseyNumber} ${player.name}` : player.name;
        return `${base} – ${label}`;
      }
    }
    return base;
  };

  // Events (strukturiert) und Notes (Freitext + Line-Wechsel) zu einer
  // gemeinsamen, chronologisch sortierten Zeitleiste zusammengeführt –
  // Anzeige bleibt für den Trainer wie zuvor eine einzige Liste.
  const timelineItems = [
    ...events.map((e) => ({ kind: 'event', id: e._id, createdAt: e.createdAt, email: e.email, label: eventLabel(e) })),
    ...notes.map((n) => ({ kind: 'note', id: n._id, createdAt: n.createdAt, email: n.email, label: n.text })),
  ].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const timelineNewestFirst = [...timelineItems].reverse();

  const handleDeleteTimelineItem = (item) => (
    item.kind === 'event' ? deleteEvent(item.id) : deleteComment(item.id)
  );

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

      <div className={styles.scoreboard} aria-label={t('games.scoreboardAriaLabel', { own: ownGoals, opponent: opponentGoals })}>
        <span className={styles.scoreboardSide}>{t('games.scoreboardUs')}</span>
        <span className={styles.scoreboardScore}>{ownGoals} : {opponentGoals}</span>
        <span className={styles.scoreboardSide}>{game.opponent || t('games.noOpponent')}</span>
      </div>

      <div className={styles.clockPanel} aria-label={t('games.clockAriaLabel', { period: game.clockPeriod, time: `${clockMM}:${clockSS}` })}>
        <span className={styles.clockPeriod}>
          {game.clockPeriod > 0 ? t('games.clockPeriodLabel', { period: game.clockPeriod }) : t('games.clockNotStarted')}
        </span>
        <span className={styles.clockTime}>{clockMM}:{clockSS}</span>
        <div className={styles.clockActions}>
          {game.clockStatus === 'running' ? (
            <Button variant="secondary" size="sm" onClick={() => handleClockAction(pauseClock)}>
              <Pause size={16} aria-hidden="true" /> {t('games.clockPause')}
            </Button>
          ) : (
            <Button variant="primary" size="sm" onClick={() => handleClockAction(startClock)}>
              <Play size={16} aria-hidden="true" /> {t('games.clockStart')}
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={() => handleClockAction(nextClockPeriod)}>
            <SkipForward size={16} aria-hidden="true" /> {t('games.clockNextPeriod')}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => handleClockAction(resetClock)}>
            <RotateCcw size={16} aria-hidden="true" /> {t('games.clockReset')}
          </Button>
          <label className={styles.clockPeriodMinutes}>
            {t('games.clockPeriodMinutesLabel')}
            <input
              type="number"
              min={1}
              max={60}
              defaultValue={game.clockPeriodMinutes}
              onBlur={(e) => commitPeriodMinutes(e.target.value)}
              aria-label={t('games.clockPeriodMinutesAriaLabel')}
            />
          </label>
        </div>
      </div>

      <Button variant="secondary" size="sm" className={styles.exportReportBtn} onClick={handleExportReport} disabled={exportingReport}>
        <FileDown size={16} aria-hidden="true" /> {exportingReport ? t('games.exportingReport') : t('games.exportReportButton')}
      </Button>

      {(gameError || notesError || eventsError || reportError || clockError) && (
        <div className={styles.errorBanner} role="alert"><AlertTriangle size={16} aria-hidden="true" /> {gameError ?? notesError ?? eventsError ?? reportError ?? clockError}</div>
      )}

      <RsvpSection resourceKind="games" resourceId={id} teamId={game.teamId} />

      <MatchSquadSection gameId={id} />

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
              key={preset.type}
              type="button"
              variant="secondary"
              size="sm"
              aria-expanded={preset.needsAttribution ? openAttributionPreset === preset.type : undefined}
              onClick={() => (preset.needsAttribution
                ? setOpenAttributionPreset((current) => (current === preset.type ? null : preset.type))
                : handleAddPreset(preset.type))}
            >
              {preset.text}
            </Button>
          ))}
        </div>

        {openAttributionPreset && (
          <div className={styles.attributionPicker} role="group" aria-label={t('games.attributionAriaLabel', { event: PRESETS.find((p) => p.type === openAttributionPreset)?.text })}>
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

        {(notesLoading || eventsLoading) && timelineItems.length === 0 ? (
          <p className={styles.hint}>{t('games.loadingNotes')}</p>
        ) : timelineNewestFirst.length === 0 ? (
          <p className={styles.hint}>{t('games.noNotesYet')}</p>
        ) : (
          <ul className={styles.notesList} role="list">
            {timelineNewestFirst.map((item) => (
              <li key={`${item.kind}-${item.id}`} className={styles.noteItem}>
                <span className={styles.noteTime}>
                  {formatDate(item.createdAt, { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className={styles.noteText}>{item.label}</span>
                {game.teamId && <span className={styles.noteAuthor}>{item.email}</span>}
                <Button
                  variant="danger"
                  size="sm"
                  iconOnly
                  className={styles.noteDeleteBtn}
                  onClick={() => handleDeleteTimelineItem(item)}
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
