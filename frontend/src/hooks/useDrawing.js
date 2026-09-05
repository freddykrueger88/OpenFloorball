/**
 * useDrawing – State-Management für Zeichen-Elemente UND Spieler-Positionen
 *
 * Features:
 *   - Ein gemeinsamer Undo/Redo-Verlauf (bis zu 50 Schritte) für gezeichnete
 *     Elemente (Pfeile, Freihand) UND Spieler-Positionen (Drag/Nudge/
 *     Formation) – Strg+Z macht immer die zeitlich letzte Aktion rückgängig,
 *     unabhängig davon, ob das ein Pfeil oder ein verschobener Spieler war.
 *   - Elemente hinzufügen, aktualisieren, löschen
 *   - Freihand-Zeichnen (laufend Punkte hinzufügen)
 *   - Aktives Tool & Farbe verwalten
 *   - Tastaturkürzel (Strg+Z, Strg+Y, Entf)
 *
 * `players`+`elements`+`undoStack`+`redoStack` laufen über einen
 * useReducer statt mehrerer useState: bei jedem Undo/Redo-Schritt müssen
 * players+elements atomar zusammen gelesen und geschrieben werden – ein
 * Reducer garantiert das auch bei mehreren synchronen dispatch()-Aufrufen
 * hintereinander (jumpHistory() für Mehrfach-Schritte), ohne sich auf
 * verschachtelte funktionale setState-Updates verlassen zu müssen.
 */
import { useReducer, useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { TOOLS, GOALKEEPER_TOOLS, DEFAULT_COLORS, MAX_UNDO_STEPS, KOMM_PHRASES, KOMM_DEFAULT_PHRASE_KEY } from '../constants/drawingConfig.js';
import useAnnounceStore from '../store/announceStore.js';

let _id = 0;
const uid = () => `el_${++_id}_${Date.now()}`;

// Standard-Phrase für per Drag gezeichnete Torwart-Kommunikations-Blasen
// (Formular lässt eine freie Phrase wählen und überschreibt text).
const defaultKommLabelKey = KOMM_PHRASES.find((p) => p.key === KOMM_DEFAULT_PHRASE_KEY)?.labelKey;

const initialState = { players: [], elements: [], undoStack: [], redoStack: [] };

function pushEntry(stack, players, elements, label) {
  return [...stack.slice(-MAX_UNDO_STEPS + 1), { players, elements, label }];
}

function editorReducer(state, action) {
  switch (action.type) {
    case 'ADD_ELEMENT':
      return {
        ...state,
        elements: [...state.elements, action.element],
        undoStack: pushEntry(state.undoStack, state.players, state.elements, action.label ?? 'add'),
        redoStack: [],
      };
    // Laufende Zwischen-Updates während einer Zeichen-Geste (Freihand-Punkte,
    // Pfeil-Endpunkt) – kein Undo-Push, der Startpunkt wurde bei ADD_ELEMENT
    // (handlePointerDown) schon gepusht.
    case 'SET_ELEMENTS_RAW':
      return { ...state, elements: action.updater(state.elements) };
    case 'UPDATE_ELEMENT':
      return {
        ...state,
        elements: state.elements.map((el) => (el.id === action.id ? { ...el, ...action.patch } : el)),
        undoStack: pushEntry(state.undoStack, state.players, state.elements, 'update'),
        redoStack: [],
      };
    case 'DELETE_ELEMENT':
      return {
        ...state,
        elements: state.elements.filter((el) => el.id !== action.id),
        undoStack: pushEntry(state.undoStack, state.players, state.elements, 'delete'),
        redoStack: [],
      };
    case 'CLEAR_ALL':
      if (state.elements.length === 0) return state;
      return {
        ...state,
        elements: [],
        undoStack: pushEntry(state.undoStack, state.players, state.elements, 'clear'),
        redoStack: [],
      };
    // Spieler-Drag/-Nudge (bisher gar nicht undo-bar, siehe Hook-Kommentar oben)
    case 'MOVE_PLAYER':
      return {
        ...state,
        players: state.players.map((p) => (p.id === action.id ? { ...p, x: action.x, y: action.y } : p)),
        undoStack: pushEntry(state.undoStack, state.players, state.elements, 'movePlayer'),
        redoStack: [],
      };
    // Formation-Vorlage laden ist eine bewusste Taktik-Entscheidung, daher undo-bar
    case 'APPLY_FORMATION':
      return {
        ...state,
        players: action.players,
        undoStack: pushEntry(state.undoStack, state.players, state.elements, action.label ?? 'formation'),
        redoStack: [],
      };
    // Metadaten-Edits (Name, Roster-Zuweisung) zählen bewusst NICHT als
    // Taktik-Undo-Schritt – kein Push.
    case 'SET_PLAYERS_RAW':
      return { ...state, players: action.updater(state.players) };
    // Frame-Wechsel / Feldtyp-Rescale: players+elements komplett ersetzen,
    // Verlauf zurücksetzen (ein alter Undo-Schritt darf nicht in einen
    // anderen Frame "zurückspringen").
    case 'LOAD_SCENE':
      return { players: action.players ?? [], elements: action.elements ?? [], undoStack: [], redoStack: [] };
    // Echtzeit-Co-Editing (ROADMAP-Backlog): wendet eine von einer anderen
    // Person empfangene Operation an – bewusst OHNE undoStack/redoStack
    // anzufassen, damit Strg+Z auf diesem Client niemals eine fremde
    // Aktion rückgängig macht.
    case 'REMOTE_OP': {
      const { op } = action;
      switch (op.kind) {
        case 'movePlayer':
          return { ...state, players: state.players.map((p) => (p.id === op.id ? { ...p, x: op.x, y: op.y } : p)) };
        case 'addElement':
          return { ...state, elements: [...state.elements, op.element] };
        case 'updateElement':
          return { ...state, elements: state.elements.map((el) => (el.id === op.id ? { ...el, ...op.patch } : el)) };
        case 'deleteElement':
          return { ...state, elements: state.elements.filter((el) => el.id !== op.id) };
        case 'clearAll':
          return { ...state, elements: [] };
        case 'applyFormation':
          return { ...state, players: op.players };
        default:
          return state;
      }
    }
    case 'UNDO': {
      if (state.undoStack.length === 0) return state;
      const entry = state.undoStack[state.undoStack.length - 1];
      return {
        ...state,
        players: entry.players,
        elements: entry.elements,
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [...state.redoStack, { players: state.players, elements: state.elements, label: entry.label }],
      };
    }
    case 'REDO': {
      if (state.redoStack.length === 0) return state;
      const entry = state.redoStack[state.redoStack.length - 1];
      return {
        ...state,
        players: entry.players,
        elements: entry.elements,
        redoStack: state.redoStack.slice(0, -1),
        undoStack: [...state.undoStack, { players: state.players, elements: state.elements, label: entry.label }],
      };
    }
    default:
      return state;
  }
}

// onLocalChange (ROADMAP-Backlog "Echtzeit-Co-Editing"): optionaler
// Callback, der bei jeder broadcast-fähigen lokalen Mutation mit einem
// serialisierbaren Op-Objekt aufgerufen wird (siehe REMOTE_OP oben) –
// BoardEditorPage.jsx nutzt das, um die Operation über die Presence-
// WebSocket an andere Nutzer zu verteilen. Bewusst NICHT für
// SET_ELEMENTS_RAW (Zwischenpunkte einer laufenden Geste), LOAD_SCENE
// (Frame-Wechsel bleibt lokal) und SET_PLAYERS_RAW (Name/Roster-Edits,
// wie beim Undo keine Taktik-Aktion).
export function useDrawing(onLocalChange) {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language === 'en';

  const [state, dispatch] = useReducer(editorReducer, initialState);
  const { players, elements, undoStack, redoStack } = state;
  // Für handlePointerUp: liest den Stand des GERADE fertiggestellten
  // Elements, ohne dass sich handlePointerUps eigene Callback-Identität
  // bei jedem Zwischenpunkt einer laufenden Geste ändern müsste (das
  // würde den mouseup/touchend-Fenster-Listener-Effekt weiter unten bei
  // jedem Punkt neu an-/abmelden) – gleiches Ref-Muster wie dataRef in
  // useAutoSave.js.
  const elementsRef = useRef(elements);
  elementsRef.current = elements;

  const [activeTool,  setActiveToolState]  = useState('move');
  const changeTool = useCallback((tool) => {
    const toolDef = TOOLS[tool];
    const label = (isEn ? toolDef?.labelEn : toolDef?.label) ?? tool;
    useAnnounceStore.getState().announce(t('drawing.announceTool', { tool: label }));
    setActiveToolState(tool);
  }, [isEn, t]);
  // Torhüter-Werkzeuge (CLAUDE.md §9.7): 'auto' | 'left' | 'right' – legt
  // fest, auf welches Tor Winkel/Rebound/Konter zeigen ('auto' = zum
  // nächstgelegenen Tor, wird beim Rendern aufgelöst, siehe angleMath.js).
  // Ein gemeinsamer State für alle drei Werkzeuge (Tor-Auswahl ist eine
  // Eingabe von "auf welches Tor denkt der Trainer gerade").
  const [winkelGoalSide, setWinkelGoalSide] = useState('auto');
  const [activeColor, setActiveColorState] = useState(DEFAULT_COLORS[0].hex);
  const [strokeWidth, setStrokeWidthState] = useState(3);
  const changeColor = useCallback((hex) => {
    const colorDef = DEFAULT_COLORS.find((c) => c.hex === hex);
    const label = (isEn ? colorDef?.labelEn : colorDef?.label) ?? hex;
    useAnnounceStore.getState().announce(t('drawing.announceColor', { color: label }));
    setActiveColorState(hex);
  }, [isEn, t]);
  const changeStrokeWidth = useCallback((width) => {
    useAnnounceStore.getState().announce(t('drawing.announceStrokeWidth', { width }));
    setStrokeWidthState(width);
  }, [t]);
  const [selectedId,  setSelectedId]  = useState(null);
  const [isDrawing,   setIsDrawing]   = useState(false);
  const currentElRef = useRef(null); // Laufendes Freihand-Element

  // ── Undo/Redo ────────────────────────────────────────────────────────
  const undo = useCallback(() => dispatch({ type: 'UNDO' }), []);
  const redo = useCallback(() => dispatch({ type: 'REDO' }), []);

  // Springt direkt zu einem Punkt in der Verlaufsliste (Issue #48) – ruft
  // die bereits geprüfte undo()/redo()-Logik wiederholt auf, statt die
  // Stack-Mechanik ein zweites Mal zu implementieren.
  const jumpHistory = useCallback((steps) => {
    if (steps > 0) { for (let i = 0; i < steps; i++) redo(); }
    else if (steps < 0) { for (let i = 0; i < -steps; i++) undo(); }
  }, [undo, redo]);

  // ── Element CRUD ───────────────────────────────────────────────────────
  const addElement = useCallback((el) => {
    const element = { ...el, id: uid() };
    dispatch({ type: 'ADD_ELEMENT', element, label: 'add' });
    onLocalChange?.({ kind: 'addElement', element });
  }, [onLocalChange]);

  const updateElement = useCallback((id, patch) => {
    dispatch({ type: 'UPDATE_ELEMENT', id, patch });
    onLocalChange?.({ kind: 'updateElement', id, patch });
  }, [onLocalChange]);

  const deleteElement = useCallback((id) => {
    dispatch({ type: 'DELETE_ELEMENT', id });
    setSelectedId((s) => (s === id ? null : s));
    onLocalChange?.({ kind: 'deleteElement', id });
  }, [onLocalChange]);

  // Spieler+Elemente eines Frames übernehmen (Frame-Wechsel, Feldtyp-
  // Rescale) – setzt Undo/Redo zurück.
  const loadScene = useCallback((newPlayers = [], newElements = []) => {
    dispatch({ type: 'LOAD_SCENE', players: newPlayers, elements: newElements });
    setSelectedId(null);
  }, []);

  const clearAll = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL' });
    setSelectedId(null);
    onLocalChange?.({ kind: 'clearAll' });
  }, [onLocalChange]);

  // Spieler verschieben (Drag oder Pfeiltasten-Nudge, siehe BoardEditorPage.jsx)
  const movePlayer = useCallback((id, x, y) => {
    dispatch({ type: 'MOVE_PLAYER', id, x, y });
    onLocalChange?.({ kind: 'movePlayer', id, x, y });
  }, [onLocalChange]);

  // Formations-Vorlage laden (Issue #46) – undo-bar
  const applyFormation = useCallback((newPlayers, label = 'formation') => {
    dispatch({ type: 'APPLY_FORMATION', players: newPlayers, label });
    onLocalChange?.({ kind: 'applyFormation', players: newPlayers });
  }, [onLocalChange]);

  // Echtzeit-Co-Editing: wendet eine von einer anderen Person empfangene
  // Operation an (siehe REMOTE_OP-Reducer-Case oben).
  const applyRemote = useCallback((op) => {
    dispatch({ type: 'REMOTE_OP', op });
  }, []);

  // Metadaten-Edits ohne Undo-Anbindung (Name, Roster-Zuweisung)
  const setPlayersRaw = useCallback((updater) => {
    dispatch({ type: 'SET_PLAYERS_RAW', updater: typeof updater === 'function' ? updater : () => updater });
  }, []);

  // ── Zeichen-Events (Canvas-Koordinaten in Metern) ─────────────────────
  const handlePointerDown = useCallback((x_m, y_m) => {
    // 'comment' erzeugt kein Frame-Element (siehe drawingConfig.js) – wird
    // in BoardEditorPage.jsx VOR diesem Handler abgefangen (öffnet einen
    // Dialog statt zu zeichnen). Guard hier zusätzlich als Absicherung,
    // falls der Handler doch einmal direkt aufgerufen würde.
    if (activeTool === 'select' || activeTool === 'eraser' || activeTool === 'comment') return;
    const tool = TOOLS[activeTool];
    if (!tool) return;

    setIsDrawing(true);

    if (activeTool === 'freehand') {
      const el = {
        id: uid(),
        type: 'freehand',
        points: [x_m, y_m],
        color: activeColor,
        strokeWidth,
        dash: [],
        arrowHead: false,
      };
      currentElRef.current = el.id;
      dispatch({ type: 'ADD_ELEMENT', element: el, label: 'freehand' });
    } else {
      // Pfeil/Linie/Zone: Startpunkt setzen, Endpunkt = Startpunkt (wird
      // on-move aktualisiert) – fillOpacity ist nur bei 'zone' gesetzt
      // (siehe drawingConfig.js), für Pfeile schlicht undefined.
      const el = {
        id: uid(),
        type: activeTool,
        x1: x_m, y1: y_m,
        x2: x_m, y2: y_m,
        color: activeColor,
        strokeWidth: tool.strokeWidth ?? strokeWidth,
        dash: tool.dash ?? [],
        arrowHead: tool.arrowHead ?? true,
        fillOpacity: tool.fillOpacity,
        // Torhüter-Werkzeuge (Winkel/Rebound/Konter/Komm): das Ziel-Tor wird
        // am Element gespeichert (explizit aufgelöst beim Anlegen; 'auto'
        // bleibt nur bei untypischer Weitergabe stehen und wird im
        // Renderer aufgelöst). Torwart-Kommunikation trägt zusätzlich eine
        // eingebrannte Phrase (die Standard-Phrase; das Formular wählt eine
        // andere und überschreibt text): der Offline-Export rendert die
        // Blase dann ohne i18n.
        goalSide: GOALKEEPER_TOOLS.includes(activeTool) ? winkelGoalSide : undefined,
        text: activeTool === 'komm' ? t(defaultKommLabelKey) : undefined,
      };
      currentElRef.current = el.id;
      dispatch({ type: 'ADD_ELEMENT', element: el, label: activeTool });
    }
  }, [activeTool, activeColor, strokeWidth, winkelGoalSide, t]);

  const handlePointerMove = useCallback((x_m, y_m) => {
    if (!isDrawing || !currentElRef.current) return;
    const id = currentElRef.current;

    dispatch({
      type: 'SET_ELEMENTS_RAW',
      updater: (prev) => prev.map((el) => {
        if (el.id !== id) return el;
        if (el.type === 'freehand') {
          return { ...el, points: [...el.points, x_m, y_m] };
        }
        // Torwart-Winkel: die Spitze (der Torwart-Standort) ist der Punkt,
        // der den Cursor verfolgt – nicht das (ignorierte) x2/y2-Ende.
        if (el.type === 'winkel') {
          return { ...el, x1: x_m, y1: y_m };
        }
        return { ...el, x2: x_m, y2: y_m };
      }),
    });
  }, [isDrawing]);

  // Broadcastet das FERTIGE Element erst hier (nicht schon bei
  // handlePointerDown, wo nur der Startpunkt existiert) – Peers sehen ein
  // gezeichnetes Element also erst fertig, kein Punkt-für-Punkt-Streaming
  // während der Geste (siehe Hook-Kommentar oben).
  const handlePointerUp = useCallback(() => {
    const finishedId = currentElRef.current;
    if (finishedId && onLocalChange) {
      const finished = elementsRef.current.find((el) => el.id === finishedId);
      if (finished) onLocalChange({ kind: 'addElement', element: finished });
    }
    setIsDrawing(false);
    currentElRef.current = null;
  }, [onLocalChange]);

  // Fallback fürs Loslassen: das gerade gezeichnete Element (Pfeilspitze am
  // Cursor) liegt über dem unsichtbaren Hit-Rect und kann dessen
  // onMouseUp/onTouchEnd verdecken (Konva liefert das Event an das
  // oberste getroffene Shape) – window-Listener garantiert das Loslassen
  // unabhängig davon, welches Konva-Shape gerade getroffen wird
  useEffect(() => {
    if (!isDrawing) return undefined;
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('touchend', handlePointerUp);
    return () => {
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchend', handlePointerUp);
    };
  }, [isDrawing, handlePointerUp]);

  // Tastatur-Alternative zum Ziehen mit der Maus (Issue #38 – WCAG 2.1.1):
  // erzeugt exakt dieselbe Element-Form wie handlePointerDown/Move/Up,
  // nur direkt aus fertigen Koordinaten statt schrittweise per Drag.
  // `goalSideOverride` setzt das Ziel-Tor explizit (Presets) und `extra`
  // mergt weitere Element-Felder hinein (z.B. text für die Komm-Blasen).
  const addArrowElement = useCallback((tool, x1, y1, x2, y2, goalSideOverride, extra) => {
    const toolDef = TOOLS[tool];
    if (!toolDef) return;
    const el = {
      id: uid(),
      type: tool,
      x1, y1, x2, y2,
      color: activeColor,
      strokeWidth: toolDef.strokeWidth ?? strokeWidth,
      dash: toolDef.dash ?? [],
      arrowHead: toolDef.arrowHead ?? true,
      fillOpacity: toolDef.fillOpacity,
      goalSide: GOALKEEPER_TOOLS.includes(tool) ? (goalSideOverride ?? winkelGoalSide) : undefined,
      ...extra,
    };
    dispatch({ type: 'ADD_ELEMENT', element: el, label: tool });
    onLocalChange?.({ kind: 'addElement', element: el });
    useAnnounceStore.getState().announce(t('drawing.announceElementAdded'));
  }, [activeColor, strokeWidth, t, onLocalChange, winkelGoalSide]);

  const addFreehandElement = useCallback((points) => {
    const el = {
      id: uid(),
      type: 'freehand',
      points,
      color: activeColor,
      strokeWidth,
      dash: [],
      arrowHead: false,
    };
    dispatch({ type: 'ADD_ELEMENT', element: el, label: 'freehand' });
    onLocalChange?.({ kind: 'addElement', element: el });
    useAnnounceStore.getState().announce(t('drawing.announceElementAdded'));
  }, [activeColor, strokeWidth, t, onLocalChange]);

  // Eraser: Element per Klick löschen
  const handleElementClick = useCallback((id) => {
    if (activeTool === 'eraser') {
      deleteElement(id);
    } else if (activeTool === 'select') {
      setSelectedId((prev) => prev === id ? null : id);
    }
  }, [activeTool, deleteElement]);

  // ── Tastaturkürzel ─────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      // Undo / Redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); return; }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); redo(); return; }

      // Tool-Shortcuts
      const key = e.key.toUpperCase();
      if (key === 'M')      changeTool('move');
      if (key === 'P')      changeTool('pass');
      if (key === 'S')      changeTool('shot');
      if (key === 'F')      changeTool('freehand');
      if (key === 'Z')      changeTool('zone');
      if (key === 'W')      changeTool('winkel');
      if (key === 'R')      changeTool('rebound');
      if (key === 'K')      changeTool('konter');
      if (key === 'G')      changeTool('komm');
      if (key === 'C')      changeTool('comment');
      if (key === 'E')      changeTool('eraser');
      if (e.key === 'Escape') changeTool('select');

      // Ausgewähltes Element löschen
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault();
        deleteElement(selectedId);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo, selectedId, deleteElement, changeTool]);

  return {
    // State
    players, elements, selectedId, isDrawing,
    activeTool,  setActiveTool: changeTool,
    activeColor, setActiveColor: changeColor,
    strokeWidth, setStrokeWidth: changeStrokeWidth,
    winkelGoalSide, setWinkelGoalSide,
    // Undo/Redo (gemeinsam für players + elements)
    undo, redo, jumpHistory,
    undoStack, redoStack,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    // Aktionen
    addElement, updateElement, deleteElement, clearAll, loadScene,
    movePlayer, applyFormation, setPlayersRaw,
    applyRemote,
    handlePointerDown, handlePointerMove, handlePointerUp,
    handleElementClick,
    addArrowElement, addFreehandElement,
  };
}
