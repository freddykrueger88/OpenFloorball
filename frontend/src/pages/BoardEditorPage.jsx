/**
 * BoardEditorPage – Die Taktik-Ansicht eines einzelnen Boards
 *
 * Verbindet:
 *  - FieldContainer (Spielfeld + Spieler + Zeichnungen)
 *  - FrameTimeline (Frame-Verwaltung)
 *  - PlaybackControls + useAnimation (Issue #11)
 *  - useAutoSave (Positionsränderungen des aktiven Frames sichern)
 *  - TeamColorPanel (Issue #14 – v0.4.0)
 *  - ExportPanel (Issue #15 – v0.5.0)
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
  Eye,
  Pencil,
  Users,
  Undo2,
  Redo2,
  Keyboard,
  Layers,
  Star,
  Video,
  Download,
  Clipboard,
  MessageCircle,
  History,
  Settings,
  Loader2,
  Check,
  AlertTriangle,
  WifiOff,
  Library,
  HelpCircle,
} from 'lucide-react';

import { IFF_FIELDS, DEFAULT_TEAM_COLORS, IFF_BALL_COLORS, ensureBall, BALL_ID, buildDefaultPlayers } from '../constants/fieldConfig.js';
import { POSITION_HINTS } from '../constants/positionHints.js';
import { EDITOR_TOUR_STEPS } from '../constants/tourSteps.js';
import { rescalePlayers, rescaleElements } from '../utils/fieldRescale.js';
import { teamColorToFillStroke, normalizeStoredColor } from '../utils/color.js';
import useAnnounceStore from '../store/announceStore.js';
import useThemeStore from '../store/themeStore.js';
import useAuthStore from '../store/authStore.js';
import useTourStore from '../store/tourStore.js';
import TourOverlay from '../components/layout/TourOverlay.jsx';

import FieldContainer from '../components/field/FieldContainer.jsx';
import FieldSettingsPanel from '../components/field/FieldSettingsPanel.jsx';
import FieldTypeChangeDialog from '../components/field/FieldTypeChangeDialog.jsx';
import PlayerInfoPanel from '../components/field/PlayerInfoPanel.jsx';
import TeamColorPanel from '../components/field/TeamColorPanel.jsx';
import PlayerAccessibleList from '../components/field/PlayerAccessibleList.jsx';
import { DrawingToolbar, DrawingCoordinatesForm } from '../components/drawing/index.js';
import { FrameTimeline } from '../components/frames/index.js';
import { PlaybackControls } from '../components/playback/index.js';
import { NotesPanel, BoardDetailsPanel, ExportPanel, PdfExportPanel, ShortcutsOverlay, ShareBoardModal, BoardSidePanelTabs, VersionsPanel, VideoPanel, BoardLinesPanel } from '../components/board/index.js';
import PublishBoardModal from '../components/library/PublishBoardModal.jsx';
import { FormationsPanel } from '../components/formations/index.js';
import CommentsPanel from '../components/comments/CommentsPanel.jsx';
import Button from '../components/common/Button.jsx';

import { useBoardsApi } from '../hooks/useBoardsApi.js';
import { useFrames } from '../hooks/useFrames.js';
import { useFormations } from '../hooks/useFormations.js';
import { useLines } from '../hooks/useLines.js';
import { useRoster } from '../hooks/useRoster.js';
import { useTeams } from '../hooks/useTeams.js';
import { useField } from '../hooks/useField.js';
import { useDrawing } from '../hooks/useDrawing.js';
import { useAutoSave } from '../hooks/useAutoSave.js';
import { useAnimation } from '../hooks/useAnimation.js';
import { usePresence } from '../hooks/usePresence.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';

import styles from './BoardEditorPage.module.css';

const PLAYER_MARGIN_M = 0.8;
const NUDGE_STEP_M = 0.15;
const DEFAULT_BALL_COLOR = IFF_BALL_COLORS.find((c) => c.id === 'orange')?.hex ?? '#f97316';
const EXPORT_W = 1280;
const EXPORT_H = 720;

export default function BoardEditorPage() {
  const { id: boardId } = useParams();
  const { t, i18n } = useTranslation();
  const activeTheme = useThemeStore((s) => s.theme);

  const { fetchBoard, updateBoard } = useBoardsApi();
  const [board, setBoard] = useState(null);
  const [notes, setNotes] = useState('');
  useDocumentTitle(board?.name);

  // ROADMAP Phase 4: aktuellen Board-Stand für die Konflikt-Baseline lesen,
  // ohne dass die patchBoard-Aufrufer bei jeder Board-Änderung neu erzeugt
  // werden müssen (analog framesRef in useFrames.js).
  const boardRef = useRef(board);
  useEffect(() => { boardRef.current = board; }, [board]);

  // Gemeinsamer Pfad für alle "Hintergrund speichern"-Board-Updates unten:
  // reicht baselineUpdatedAt/label für die Offline-Konflikterkennung durch
  // (siehe offlineSync.js) und hält board.updatedAt nach jedem
  // erfolgreichen Schreiben aktuell, damit die NÄCHSTE Baseline stimmt.
  // Fehler/Offline-Queueing wird hier bewusst geschluckt (kein Fehler-UI
  // pro Einzelfeld) – wie schon vor dieser Umstellung.
  const patchBoard = useCallback(async (fields) => {
    try {
      const updated = await updateBoard(boardId, fields, {
        baselineUpdatedAt: boardRef.current?.updatedAt ?? null,
        label: boardRef.current?.name ?? null,
      });
      setBoard(updated);
    } catch { /* Hintergrund-Speichern, siehe Kommentar oben */ }
  }, [boardId, updateBoard]);

  // Issue #14 – Teamfarben & Ball (als einzelner Hex-String persistiert,
  // {fill,stroke} wird erst beim Rendern abgeleitet – Issue #33)
  const [homeColor, setHomeColor] = useState(DEFAULT_TEAM_COLORS.home.fill);
  const [awayColor, setAwayColor] = useState(DEFAULT_TEAM_COLORS.away.fill);
  const [ballColor, setBallColor] = useState(DEFAULT_BALL_COLOR);

  const handleChangeHomeColor = useCallback((hex) => {
    setHomeColor(hex);
    patchBoard({ homeColor: hex });
  }, [patchBoard]);

  const handleChangeAwayColor = useCallback((hex) => {
    setAwayColor(hex);
    patchBoard({ awayColor: hex });
  }, [patchBoard]);

  const handleChangeBallColor = useCallback((hex) => {
    setBallColor(hex);
    patchBoard({ ballColor: hex });
  }, [patchBoard]);

  // ROADMAP-Backlog "Gegner-Tagging"
  const handleChangeOpponent = useCallback((opponent) => {
    setBoard((prev) => (prev ? { ...prev, opponent } : prev));
    patchBoard({ opponent });
  }, [patchBoard]);

  // ROADMAP-Backlog "Übungsbibliothek"
  const handleChangeCategory = useCallback((category) => {
    setBoard((prev) => (prev ? { ...prev, category } : prev));
    patchBoard({ category });
  }, [patchBoard]);

  const handleChangeAgeGroup = useCallback((ageGroup) => {
    setBoard((prev) => (prev ? { ...prev, ageGroup } : prev));
    patchBoard({ ageGroup });
  }, [patchBoard]);

  const handleChangeGoal = useCallback((goal) => {
    setBoard((prev) => (prev ? { ...prev, goal } : prev));
    patchBoard({ goal });
  }, [patchBoard]);

  const handleChangeMaterial = useCallback((material) => {
    setBoard((prev) => (prev ? { ...prev, material } : prev));
    patchBoard({ material });
  }, [patchBoard]);

  const field = useField('large');
  const {
    frames, activeFrame, activeIndex, loading: framesLoading,
    loadFrames, addFrame, updateFrame, deleteFrame, reorderFrames, goToFrame,
  } = useFrames(boardId, field.fieldType, board?.name);

  // Echtzeit-Co-Editing (ROADMAP-Backlog): useDrawing (broadcastet lokale
  // Aktionen) und usePresence (relayt + empfängt) hängen wechselseitig
  // voneinander ab. Statt einer Initialisierungsreihenfolge-Abhängigkeit
  // zwischen den beiden Hooks: Refs, die immer den aktuellen Stand halten
  // (analog boardRef oben), die stabilen Callbacks unten lesen daraus.
  const activeFrameRef = useRef(activeFrame);
  useEffect(() => { activeFrameRef.current = activeFrame; }, [activeFrame]);
  const presenceRef = useRef(null);

  const handleLocalDrawingOp = useCallback((op) => {
    const frameId = activeFrameRef.current?._id;
    if (!frameId) return;
    presenceRef.current?.sendOp(frameId, op);
  }, []);

  const drawing = useDrawing(handleLocalDrawingOp);
  const currentUserId = useAuthStore((s) => s.user?.id);

  // Nur das gerade gemeinsam betrachtete Frame wird live gemerged – ein
  // Frame-Wechsel bei einer anderen Person "entführt" nicht die eigene
  // Ansicht (siehe Plan "Nicht im Umfang").
  // Kein Problem, dass sich diese Callback-Identität bei jedem Render
  // ändert (drawing ist ein frisches Objektliteral pro Render) – usePresence
  // liest onOp intern über eine Ref, nicht über die Effekt-Dependency-Liste.
  const handleRemoteOp = useCallback(({ frameId, op }) => {
    if (frameId !== activeFrameRef.current?._id) return;
    drawing.applyRemote(op);
  }, [drawing]);

  const presence = usePresence(boardId, { onOp: handleRemoteOp });
  presenceRef.current = presence;
  const otherPresentUsers = presence.users.filter((u) => u.userId !== currentUserId);
  const formations = useFormations();
  const lines = useLines();
  const roster = useRoster();
  // ROADMAP Phase 2: eigene Teams laden, um Formations-Vorlagen optional
  // team-geteilt statt rein persönlich anzulegen (analog Roster/Trainings).
  const { teams, fetchTeams } = useTeams();
  const teamsICanShareWith = teams.filter((tm) => tm.role === 'owner' || tm.role === 'coach');

  const [selectedPlayerId, setSelectedPlayerId] = useState(null);

  const [showNames, setShowNames] = useState(false);
  const [namePosition, setNamePosition] = useState('unten');

  // Positions-Hinweise bei Hover (Issue #27)
  const [showHints, setShowHints] = useState(
    () => localStorage.getItem('openfloorball:showHints') !== 'false'
  );
  const toggleShowHints = useCallback(() => {
    setShowHints((v) => {
      const next = !v;
      localStorage.setItem('openfloorball:showHints', String(next));
      return next;
    });
  }, []);

  const handleNameChange = useCallback((id, name) => {
    drawing.setPlayersRaw((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
  }, [drawing]);

  // Issue #53 – Spieler direkt aus dem zentralen Kader zuweisen (Name +
  // Rückennummer), rein optional, ersetzt nicht die freie Eingabe
  const handleAssignRoster = useCallback((id, rosterPlayer) => {
    drawing.setPlayersRaw((prev) => prev.map((p) => (p.id === id
      ? { ...p, name: rosterPlayer.name, number: rosterPlayer.jerseyNumber ?? undefined }
      : p)));
  }, [drawing]);

  // "Position zurücksetzen"-Button im PlayerInfoPanel: Spieler-ids (h1..h6/
  // a1..a6) sind über alle Feldtypen stabil (siehe fieldConfig.js), daher
  // reicht ein Id-Match gegen buildDefaultPlayers statt Rollen-Logik.
  // movePlayer (nicht setPlayersRaw) hält das undo-bar wie Drag&Drop.
  const handleResetPlayerPosition = useCallback((id) => {
    const defaultPlayer = buildDefaultPlayers(field.fieldType).find((p) => p.id === id);
    if (defaultPlayer) drawing.movePlayer(id, defaultPlayer.x, defaultPlayer.y);
  }, [drawing, field.fieldType]);

  // Backlog: Lines sollen auch im Spielfeld schnell durchwechselbar sein.
  // Trägt die Namen/Nummern der Line-Spieler auf die Heimteam-Positionen
  // des aktuellen Frames ein, nach Rolle sortiert (gleiche Rollen-Codes
  // TW/V/C/S wie roster_players) – analog handleAssignRoster, nur für
  // eine ganze Line auf einmal statt einen einzelnen Spieler. Ändert
  // bewusst nur Rollen, die die Line auch enthält; andere Positionen
  // bleiben unverändert (kein ungewolltes Leeren bestehender Namen).
  const handleApplyLine = useCallback((line) => {
    const playersByRole = {};
    line.players.forEach((p) => {
      if (!p.role) return;
      (playersByRole[p.role] ??= []).push(p);
    });
    const nextIndexByRole = {};
    drawing.setPlayersRaw((prev) => prev.map((tok) => {
      if (tok.team !== 'home' || !tok.role) return tok;
      const pool = playersByRole[tok.role];
      if (!pool) return tok;
      const idx = nextIndexByRole[tok.role] ?? 0;
      const player = pool[idx];
      if (!player) return tok;
      nextIndexByRole[tok.role] = idx + 1;
      return { ...tok, name: player.name, number: player.jerseyNumber ?? undefined };
    }));
    lines.setActive(line._id, true).catch(() => {});
  }, [drawing, lines]);

  const anim = useAnimation({ frames, activeIndex, goToFrame, arrowKeysEnabled: !selectedPlayerId });

  useEffect(() => {
    if (!boardId) return;
    fetchBoard(boardId).then((b) => {
      setBoard(b);
      setNotes(b?.notes ?? '');
      if (b?.fieldType) field.setFieldType(b.fieldType);
      if (b?.homeColor) setHomeColor(normalizeStoredColor(b.homeColor) ?? DEFAULT_TEAM_COLORS.home.fill);
      if (b?.awayColor) setAwayColor(normalizeStoredColor(b.awayColor) ?? DEFAULT_TEAM_COLORS.away.fill);
      if (b?.ballColor) setBallColor(b.ballColor);
    }).catch(() => {});
    loadFrames();
    formations.fetchFormations();
    lines.fetchLines().catch(() => {});
    roster.fetchRoster().catch(() => {});
    fetchTeams().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId]);

  const saveNotes = useCallback(async (nextNotes) => {
    if (!boardId) return;
    const updated = await updateBoard(boardId, { notes: nextNotes }, {
      baselineUpdatedAt: boardRef.current?.updatedAt ?? null,
      label: boardRef.current?.name ?? null,
    });
    setBoard(updated);
  }, [boardId, updateBoard]);

  // Issue #51 MVP: read-Kollaboratoren dürfen nicht schreiben – Autosave
  // sonst würde alle 30s unnötig gegen die (jetzt korrekt 404 liefernde)
  // API laufen und einen Dauer-Fehlerstatus anzeigen.
  const canEdit = board?.accessLevel !== 'read';
  useAutoSave(notes, saveNotes, !!board && canEdit);

  useEffect(() => {
    if (anim.playing) return;
    drawing.loadScene(activeFrame?.players ?? [], activeFrame?.elements ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFrame?._id, anim.playing]);

  const saveActiveFrame = useCallback(async ({ players, elements }) => {
    if (!activeFrame?._id) return;
    await updateFrame(activeFrame._id, { players, elements });
  }, [activeFrame, updateFrame]);

  // Issue #54: vorher wurden nur die Spieler-Positionen beobachtet –
  // gezeichnete Pfeile/Linien lösten dadurch kein Autosave aus und gingen
  // beim Frame-Wechsel verloren, da drawing.elements noch nicht gespeichert war.
  const { status: saveStatus, saveNow: saveFrameNow } = useAutoSave(
    { players: drawing.players, elements: drawing.elements },
    saveActiveFrame,
    !!activeFrame && !anim.playing && canEdit,
  );

  // Zusätzlich zum Debounce explizit vor einem manuellen Frame-Wechsel
  // flushen, damit auch sehr kurz aufeinanderfolgende Aktionen (zeichnen
  // → sofort Frame wechseln, innerhalb der 300ms-Debounce-Zeit) nichts
  // verlieren.
  const handleFrameSelect = useCallback(async (index) => {
    if (canEdit && !anim.playing) {
      await saveFrameNow();
    }
    goToFrame(index);
  }, [canEdit, anim.playing, saveFrameNow, goToFrame]);

  const handleDragEndPlayer = useCallback((id, rawX, rawY) => {
    const currentField = IFF_FIELDS[field.fieldType] ?? IFF_FIELDS.large;
    const x = Math.max(PLAYER_MARGIN_M, Math.min(currentField.width  - PLAYER_MARGIN_M, rawX));
    const y = Math.max(PLAYER_MARGIN_M, Math.min(currentField.height - PLAYER_MARGIN_M, rawY));
    drawing.movePlayer(id, x, y);
  }, [field.fieldType, drawing]);

  // Spieler-Auswahl per Screenreader ansagen (Issue #19 – Teil 2)
  const handleSelectPlayer = useCallback((id) => {
    if (id === BALL_ID) {
      useAnnounceStore.getState().announce(t('boardEditor.ballSelected'));
      setSelectedPlayerId(id);
      return;
    }
    if (id) {
      const player = drawing.players.find((p) => p.id === id);
      const hintTable = POSITION_HINTS[i18n.language] ?? POSITION_HINTS.de;
      const roleName = hintTable[player?.role]?.name ?? player?.role ?? t('boardEditor.genericPlayer');
      useAnnounceStore.getState().announce(
        player?.name
          ? t('boardEditor.playerSelectedWithName', { role: roleName, name: player.name })
          : t('boardEditor.playerSelected', { role: roleName })
      );
    } else {
      useAnnounceStore.getState().announce(t('boardEditor.playerDeselected'));
    }
    setSelectedPlayerId(id);
  }, [drawing, i18n.language, t]);

  // Pfeiltasten verschieben den ausgewählten Spieler, Escape wählt ihn ab
  // (Issue #19 – Tastaturnavigation). Deaktiviert während der Wiedergabe,
  // analog zum arrowKeysEnabled-Guard in useAnimation für den Frame-Wechsel.
  useEffect(() => {
    const handler = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (!selectedPlayerId) return;

      if (e.key === 'Escape') {
        handleSelectPlayer(null);
        return;
      }
      if (anim.playing) return;

      let dx = 0;
      let dy = 0;
      if (e.key === 'ArrowUp') dy = -NUDGE_STEP_M;
      else if (e.key === 'ArrowDown') dy = NUDGE_STEP_M;
      else if (e.key === 'ArrowLeft') dx = -NUDGE_STEP_M;
      else if (e.key === 'ArrowRight') dx = NUDGE_STEP_M;
      else return;

      const current = drawing.players.find((p) => p.id === selectedPlayerId);
      if (!current) return;

      e.preventDefault();
      handleDragEndPlayer(selectedPlayerId, current.x + dx, current.y + dy);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedPlayerId, drawing, anim.playing, handleDragEndPlayer, handleSelectPlayer]);

  // "?"-Taste öffnet die Tastaturkürzel-Übersicht (Issue #47)
  const [showShortcuts, setShowShortcuts] = useState(false);
  // Issue #51 MVP – Board-Sharing (Owner-only)
  const [showShareModal, setShowShareModal] = useState(false);
  // EPIC 010 MVP – Community-Übungsbibliothek (Owner-only)
  const [showPublishModal, setShowPublishModal] = useState(false);
  useEffect(() => {
    const handler = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === '?') { e.preventDefault(); setShowShortcuts(true); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const displayedPlayers = anim.playing ? anim.displayPlayers : drawing.players;

  const [pendingFieldType, setPendingFieldType] = useState(null);
  const [changingField, setChangingField] = useState(false);

  const handleRequestFieldTypeChange = useCallback((newType) => {
    if (newType === field.fieldType) return;
    setPendingFieldType(newType);
  }, [field.fieldType]);

  const handleConfirmFieldTypeChange = useCallback(async () => {
    if (!pendingFieldType) return;
    const oldField = IFF_FIELDS[field.fieldType] ?? IFF_FIELDS.large;
    const newField = IFF_FIELDS[pendingFieldType] ?? IFF_FIELDS.large;
    const scaleX = newField.width / oldField.width;
    const scaleY = newField.height / oldField.height;

    setChangingField(true);
    try {
      const updatedBoard = await updateBoard(boardId, { fieldType: pendingFieldType }, {
        baselineUpdatedAt: boardRef.current?.updatedAt ?? null,
        label: boardRef.current?.name ?? null,
      });
      setBoard(updatedBoard);

      const rescaledLive = rescalePlayers(drawing.players, scaleX, scaleY);
      const rescaledElements = rescaleElements(drawing.elements, scaleX, scaleY);
      drawing.loadScene(rescaledLive, rescaledElements);
      if (activeFrame?._id) {
        await updateFrame(activeFrame._id, { players: rescaledLive, elements: rescaledElements });
      }

      await Promise.all(
        frames
          .filter((f) => f._id !== activeFrame?._id)
          .map((f) => updateFrame(f._id, {
            players:  rescalePlayers(f.players, scaleX, scaleY),
            elements: rescaleElements(f.elements, scaleX, scaleY),
          }))
      );

      field.setFieldType(pendingFieldType);
    } finally {
      setChangingField(false);
      setPendingFieldType(null);
    }
  }, [pendingFieldType, field, boardId, updateBoard, drawing, activeFrame, updateFrame, frames]);

  // Formations-Vorlagen (Issue #46): aktuelle Aufstellung speichern bzw.
  // eine gespeicherte Vorlage laden. Beim Laden übernimmt drawing.applyFormation
  // direkt (undo-bar) – die Persistenz läuft wie bei Drag&Drop automatisch
  // über den bestehenden useAutoSave-Hook, kein eigener Save-Call nötig.
  const handleSaveFormation = useCallback((name, teamId) => {
    // Formationen sind wiederverwendbare Spieler-Aufstellungen (Issue #46),
    // keine vollständigen Szenen-Schnappschüsse – der Ball gehört nicht dazu.
    const playersOnly = drawing.players.filter((p) => p.team !== 'ball');
    formations.saveFormation({ name, fieldType: field.fieldType, players: playersOnly, teamId });
  }, [formations, field.fieldType, drawing]);

  const handleRenameFormation = useCallback((formation, newName) => {
    formations.updateFormation(formation._id, { name: newName }, {
      baselineUpdatedAt: formation.updatedAt, label: formation.name,
    }).catch(() => {});
  }, [formations]);

  const handleLoadFormation = useCallback((template) => {
    // Formationen enthalten keinen Ball (siehe handleSaveFormation) – beim
    // Laden ergänzen, statt den Ball aus der aktuellen Szene zu verlieren.
    // Undo-bar (drawing.applyFormation), damit eine versehentlich geladene
    // Formation genau wie eine Zeichnung mit Strg+Z rückgängig zu machen ist.
    if (template.fieldType === field.fieldType) {
      drawing.applyFormation(ensureBall(template.players, field.fieldType));
      return;
    }
    const sourceField = IFF_FIELDS[template.fieldType] ?? IFF_FIELDS.large;
    const targetField = IFF_FIELDS[field.fieldType] ?? IFF_FIELDS.large;
    const scaleX = targetField.width / sourceField.width;
    const scaleY = targetField.height / sourceField.height;
    drawing.applyFormation(ensureBall(rescalePlayers(template.players, scaleX, scaleY), field.fieldType));
  }, [field.fieldType, drawing]);

  // Issue #15 – renderFrame: rendert einen Frame offline als PNG via Konva
  // Nutzt Konva.Stage direkt (kein React), um ein unsichtbares Canvas zu erstellen
  const renderFrame = useCallback(async (frame) => {
    const { default: FloorballFieldStatic } = await import('../components/field/FloorballFieldStatic.js');
    return FloorballFieldStatic({
      fieldType: field.fieldType,
      width: EXPORT_W,
      height: EXPORT_H,
      players: frame.players ?? [],
      elements: frame.elements ?? [],
      homeColor: teamColorToFillStroke(homeColor, DEFAULT_TEAM_COLORS.home.fill),
      awayColor: teamColorToFillStroke(awayColor, DEFAULT_TEAM_COLORS.away.fill),
      ballColor,
    });
  }, [field.fieldType, homeColor, awayColor, ballColor]);

  return (
    <main className={styles.page} role="main" id="main-content">
      <header className={styles.header}>
        <Link to="/boards" className={styles.backLink} aria-label={t('boardEditor.backToBoards')}>←</Link>
        <h1 className={styles.title}>{board?.name ?? t('board.untitled')}</h1>
        {board?.accessLevel === 'read' && (
          <span className={styles.readonlyBadge}><Eye size={16} aria-hidden="true" /> {t('boardShare.readonlyBadge')}</span>
        )}
        {board?.accessLevel === 'write' && (
          <span className={styles.readonlyBadge}><Pencil size={16} aria-hidden="true" /> {t('boardShare.writeBadge')}</span>
        )}
        {otherPresentUsers.length > 0 && (
          <span
            className={styles.presenceBadge}
            title={otherPresentUsers.map((u) => u.displayName).join(', ')}
          >
            <Users size={16} aria-hidden="true" /> {t('boardEditor.presenceCount', { count: otherPresentUsers.length })}
          </span>
        )}
        <span className={`${styles.saveStatus} ${styles[saveStatus] ?? ''}`} aria-live="polite" data-tour="editor-save">
          {saveStatus === 'saving'  && <><Loader2 size={14} className={styles.spin} aria-hidden="true" /> {t('boardEditor.saving')}</>}
          {saveStatus === 'saved'   && <><Check size={14} aria-hidden="true" /> {t('boardEditor.saved')}</>}
          {saveStatus === 'offline' && <><WifiOff size={14} aria-hidden="true" /> {t('boardEditor.saveOffline')}</>}
          {saveStatus === 'error'   && <><AlertTriangle size={14} aria-hidden="true" /> {t('boardEditor.saveError')}</>}
        </span>
        <div className={styles.headerControls}>
          {canEdit && (
            <>
              <Button
                variant="secondary"
                size="md"
                iconOnly
                onClick={drawing.undo}
                disabled={!drawing.canUndo}
                aria-label={t('drawing.undo')}
                title={t('drawing.undoTitle')}
              >
                <Undo2 size={18} aria-hidden="true" />
              </Button>
              <Button
                variant="secondary"
                size="md"
                iconOnly
                onClick={drawing.redo}
                disabled={!drawing.canRedo}
                aria-label={t('drawing.redo')}
                title={t('drawing.redoTitle')}
              >
                <Redo2 size={18} aria-hidden="true" />
              </Button>
            </>
          )}
          {canEdit && (
            <TeamColorPanel
              homeColor={homeColor}
              awayColor={awayColor}
              ballColor={ballColor}
              onChangeHomeColor={handleChangeHomeColor}
              onChangeAwayColor={handleChangeAwayColor}
              onChangeBallColor={handleChangeBallColor}
            />
          )}
          <Button
            variant="secondary"
            size="md"
            iconOnly
            onClick={() => setShowShortcuts(true)}
            aria-label={t('shortcuts.openLabel')}
            title={t('shortcuts.openLabel')}
          >
            <Keyboard size={18} aria-hidden="true" />
          </Button>
          <Button
            variant="secondary"
            size="md"
            iconOnly
            onClick={() => useTourStore.getState().start('editor')}
            aria-label={t('editorTour.restartLabel')}
            title={t('editorTour.restartLabel')}
          >
            <HelpCircle size={18} aria-hidden="true" />
          </Button>
        </div>
      </header>

      <TourOverlay tourId="editor" steps={EDITOR_TOUR_STEPS} settingsKey="editorTourCompleted" />

      {showShortcuts && <ShortcutsOverlay onClose={() => setShowShortcuts(false)} />}
      {showShareModal && <ShareBoardModal boardId={boardId} onClose={() => setShowShareModal(false)} />}
      {showPublishModal && (
        <PublishBoardModal boardId={boardId} onClose={() => setShowPublishModal(false)} />
      )}

      {pendingFieldType && (
        <FieldTypeChangeDialog
          targetLabel={IFF_FIELDS[pendingFieldType]?.label ?? pendingFieldType}
          onConfirm={handleConfirmFieldTypeChange}
          onCancel={() => setPendingFieldType(null)}
          loading={changingField}
        />
      )}

      <PlaybackControls
        playing={anim.playing}
        canPlay={anim.canPlay}
        togglePlay={anim.togglePlay}
        stop={anim.stop}
        speed={anim.speed}
        speeds={anim.speeds}
        setSpeed={anim.setSpeed}
        loop={anim.loop}
        setLoop={anim.setLoop}
        activeIndex={activeIndex}
        frameCount={frames.length}
        progress={anim.progress}
      />

      <div className={styles.body}>
        <div className={styles.middleRow}>
          {canEdit && (
            <DrawingToolbar
              activeTool={drawing.activeTool}
              setActiveTool={drawing.setActiveTool}
              activeColor={drawing.activeColor}
              setActiveColor={drawing.setActiveColor}
              strokeWidth={drawing.strokeWidth}
              setStrokeWidth={drawing.setStrokeWidth}
              onUndo={drawing.undo}
              onRedo={drawing.redo}
              onClear={drawing.clearAll}
              canUndo={drawing.canUndo}
              canRedo={drawing.canRedo}
              elementCount={drawing.elements.length}
              undoStack={drawing.undoStack}
              redoStack={drawing.redoStack}
              onJumpHistory={drawing.jumpHistory}
            />
          )}
          <div className={styles.fieldArea} data-tour="editor-canvas">
            <FieldContainer
              fieldType={field.fieldType}
              showGrid={field.showGrid}
              gridSize={field.gridSize}
              theme={activeTheme}
              readonly={anim.playing || !canEdit}
              players={displayedPlayers}
              selectedPlayerId={selectedPlayerId}
              onSelectPlayer={handleSelectPlayer}
              onDragEndPlayer={handleDragEndPlayer}
              homeColor={teamColorToFillStroke(homeColor, DEFAULT_TEAM_COLORS.home.fill)}
              awayColor={teamColorToFillStroke(awayColor, DEFAULT_TEAM_COLORS.away.fill)}
              ballColor={ballColor}
              drawingElements={anim.playing ? (activeFrame?.elements ?? []) : drawing.elements}
              selectedDrawingId={drawing.selectedId}
              activeTool={drawing.activeTool}
              isDrawing={drawing.isDrawing}
              onPointerDown={drawing.handlePointerDown}
              onPointerMove={drawing.handlePointerMove}
              onPointerUp={drawing.handlePointerUp}
              onElementClick={drawing.handleElementClick}
              showNames={showNames}
              namePosition={namePosition}
              showHints={showHints}
              cursors={presence.cursors}
              onFieldPointerMove={presence.sendCursor}
              onFieldPointerLeave={presence.sendCursorLeave}
            />

            {!anim.playing && (
              <PlayerAccessibleList
                players={drawing.players}
                selectedPlayerId={selectedPlayerId}
                onSelectPlayer={handleSelectPlayer}
              />
            )}

            {/* Der Ball hat keine Rolle/Namen/Roster-Zuordnung – das
                rollenbasierte Info-Panel würde für ihn falsche Hinweise
                anzeigen, daher bewusst nicht anzeigen. */}
            {!anim.playing && selectedPlayerId && selectedPlayerId !== BALL_ID && (
              <div className={styles.infoPanelWrap}>
                <PlayerInfoPanel
                  player={drawing.players.find((p) => p.id === selectedPlayerId)}
                  onClose={() => handleSelectPlayer(null)}
                  onReset={handleResetPlayerPosition}
                  onNameChange={handleNameChange}
                  rosterPlayers={roster.rosterPlayers}
                  onAssignRoster={handleAssignRoster}
                />
              </div>
            )}
          </div>
        </div>

        <FrameTimeline
          frames={frames}
          activeIndex={activeIndex}
          onSelect={handleFrameSelect}
          onAdd={canEdit ? () => addFrame(drawing.players, drawing.elements) : undefined}
          onDelete={canEdit ? deleteFrame : undefined}
          onReorder={canEdit ? reorderFrames : undefined}
          loading={framesLoading}
          currentPlayers={drawing.players}
          currentElements={drawing.elements}
        />

        <BoardSidePanelTabs
          tabs={[
            canEdit && {
              id: 'draw',
              tourId: 'editor-tab-draw',
              label: t('boardEditor.tabs.draw'),
              icon: <Pencil size={16} aria-hidden="true" />,
              content: (
                <DrawingCoordinatesForm
                  activeTool={drawing.activeTool}
                  field={IFF_FIELDS[field.fieldType] ?? IFF_FIELDS.large}
                  onAddArrow={drawing.addArrowElement}
                  onAddFreehand={drawing.addFreehandElement}
                />
              ),
            },
            canEdit && {
              id: 'lines',
              label: t('boardEditor.tabs.lines'),
              icon: <Layers size={16} aria-hidden="true" />,
              content: (
                <BoardLinesPanel
                  lines={lines.lines}
                  onApply={handleApplyLine}
                />
              ),
            },
            canEdit && {
              id: 'formations',
              label: t('boardEditor.tabs.formations'),
              icon: <Star size={16} aria-hidden="true" />,
              // UI/UX-Audit: Ende der "Bearbeiten"-Tab-Gruppe
              groupEnd: true,
              content: (
                <FormationsPanel
                  formations={formations.formations}
                  onSave={handleSaveFormation}
                  onLoad={handleLoadFormation}
                  onRename={handleRenameFormation}
                  onDelete={formations.deleteFormation}
                  canAddFormation={formations.canAddFormation}
                  teams={teamsICanShareWith}
                />
              ),
            },
            {
              id: 'video',
              label: t('boardEditor.tabs.video'),
              icon: <Video size={16} aria-hidden="true" />,
              content: <VideoPanel boardId={boardId} canEdit={canEdit} fieldType={field.fieldType} homeColor={homeColor} awayColor={awayColor} ballColor={ballColor} />,
            },
            {
              id: 'export',
              tourId: 'editor-tab-export',
              label: t('boardEditor.tabs.export'),
              icon: <Download size={16} aria-hidden="true" />,
              // UI/UX-Audit: Ende der "Medien/Export"-Tab-Gruppe
              groupEnd: true,
              content: (
                <>
                  <ExportPanel boardId={boardId} frames={frames} activeFrame={activeFrame} renderFrame={renderFrame} />
                  <PdfExportPanel frames={frames} renderFrame={renderFrame} boardName={board?.name} />
                </>
              ),
            },
            {
              id: 'notes',
              label: t('boardEditor.tabs.info'),
              icon: <Clipboard size={16} aria-hidden="true" />,
              content: (
                <>
                  <BoardDetailsPanel
                    opponent={board?.opponent}
                    onChangeOpponent={canEdit ? handleChangeOpponent : undefined}
                    category={board?.category}
                    onChangeCategory={canEdit ? handleChangeCategory : undefined}
                    ageGroup={board?.ageGroup}
                    onChangeAgeGroup={canEdit ? handleChangeAgeGroup : undefined}
                    goal={board?.goal}
                    onChangeGoal={canEdit ? handleChangeGoal : undefined}
                    material={board?.material}
                    onChangeMaterial={canEdit ? handleChangeMaterial : undefined}
                  />
                  {board?.accessLevel === 'owner' && (
                    <Button variant="secondary" size="md" onClick={() => setShowPublishModal(true)}>
                      <Library size={16} aria-hidden="true" />
                      <span>{t('library.publishButton')}</span>
                    </Button>
                  )}
                  <NotesPanel value={notes} onChange={setNotes} readonly={!canEdit} />
                </>
              ),
            },
            {
              id: 'comments',
              label: t('boardEditor.tabs.comments'),
              icon: <MessageCircle size={16} aria-hidden="true" />,
              content: <CommentsPanel resourceKind="boards" resourceId={boardId} />,
            },
            {
              id: 'history',
              label: t('boardEditor.tabs.history'),
              icon: <History size={16} aria-hidden="true" />,
              // UI/UX-Audit: Ende der "Info"-Tab-Gruppe
              groupEnd: true,
              content: <VersionsPanel boardId={boardId} canRestore={canEdit} onRestored={loadFrames} />,
            },
            {
              id: 'settings',
              label: t('boardEditor.tabs.settings'),
              icon: <Settings size={16} aria-hidden="true" />,
              content: (
                <FieldSettingsPanel
                  showNames={showNames}
                  onToggleShowNames={() => setShowNames((v) => !v)}
                  namePosition={namePosition}
                  onSetNamePosition={setNamePosition}
                  showHints={showHints}
                  onToggleShowHints={toggleShowHints}
                  fieldType={field.fieldType}
                  availableFields={field.availableFields}
                  onRequestFieldTypeChange={canEdit ? handleRequestFieldTypeChange : undefined}
                  onOpenShare={() => setShowShareModal(true)}
                  showShareButton={board?.accessLevel === 'owner'}
                />
              ),
            },
          ].filter(Boolean)}
        />
      </div>
    </main>
  );
}
