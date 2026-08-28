import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import '../i18n/i18n.js';
import { useDrawing } from './useDrawing.js';

const player = (id, x, y) => ({ id, role: 'C', team: 'home', x, y });

describe('useDrawing – vereinter Undo/Redo-Verlauf (Spieler + Elemente)', () => {
  it('movePlayer pusht Undo, undo() stellt die vorherige Position wieder her, redo() wendet sie erneut an', () => {
    const { result } = renderHook(() => useDrawing());

    act(() => { result.current.loadScene([player('h1', 2, 10)], []); });
    expect(result.current.canUndo).toBe(false);

    act(() => { result.current.movePlayer('h1', 5, 12); });
    expect(result.current.players.find((p) => p.id === 'h1')).toMatchObject({ x: 5, y: 12 });
    expect(result.current.canUndo).toBe(true);

    act(() => { result.current.undo(); });
    expect(result.current.players.find((p) => p.id === 'h1')).toMatchObject({ x: 2, y: 10 });
    expect(result.current.canRedo).toBe(true);

    act(() => { result.current.redo(); });
    expect(result.current.players.find((p) => p.id === 'h1')).toMatchObject({ x: 5, y: 12 });
  });

  it('vereint Spieler- und Element-Aktionen in EINEM Verlauf – undo() macht immer die zeitlich letzte Aktion rückgängig', () => {
    const { result } = renderHook(() => useDrawing());

    act(() => { result.current.loadScene([player('h1', 2, 10)], []); });
    act(() => { result.current.movePlayer('h1', 5, 12); });
    act(() => { result.current.addArrowElement('pass', 0, 0, 1, 1); });

    expect(result.current.players.find((p) => p.id === 'h1')).toMatchObject({ x: 5, y: 12 });
    expect(result.current.elements).toHaveLength(1);

    // Erstes undo: die zuletzt gepushte Aktion (Pfeil) rückgängig, Spieler bleibt verschoben
    act(() => { result.current.undo(); });
    expect(result.current.elements).toHaveLength(0);
    expect(result.current.players.find((p) => p.id === 'h1')).toMatchObject({ x: 5, y: 12 });

    // Zweites undo: jetzt die Spieler-Verschiebung rückgängig
    act(() => { result.current.undo(); });
    expect(result.current.players.find((p) => p.id === 'h1')).toMatchObject({ x: 2, y: 10 });
    expect(result.current.canUndo).toBe(false);

    // Redo in umgekehrter Reihenfolge: erst Spieler, dann Pfeil
    act(() => { result.current.redo(); });
    expect(result.current.players.find((p) => p.id === 'h1')).toMatchObject({ x: 5, y: 12 });
    expect(result.current.elements).toHaveLength(0);

    act(() => { result.current.redo(); });
    expect(result.current.elements).toHaveLength(1);
  });

  it('jumpHistory() springt über mehrere gemischte Schritte korrekt', () => {
    const { result } = renderHook(() => useDrawing());

    act(() => { result.current.loadScene([player('h1', 0, 0)], []); });
    act(() => { result.current.movePlayer('h1', 1, 1); });
    act(() => { result.current.movePlayer('h1', 2, 2); });
    act(() => { result.current.addArrowElement('shot', 0, 0, 1, 1); });

    act(() => { result.current.jumpHistory(-2); });
    expect(result.current.elements).toHaveLength(0);
    expect(result.current.players.find((p) => p.id === 'h1')).toMatchObject({ x: 1, y: 1 });

    act(() => { result.current.jumpHistory(2); });
    expect(result.current.elements).toHaveLength(1);
    expect(result.current.players.find((p) => p.id === 'h1')).toMatchObject({ x: 2, y: 2 });
  });

  it('loadScene() leert undoStack/redoStack (Frame-Wechsel/Feldtyp-Rescale)', () => {
    const { result } = renderHook(() => useDrawing());

    act(() => { result.current.loadScene([player('h1', 0, 0)], []); });
    act(() => { result.current.movePlayer('h1', 5, 5); });
    expect(result.current.canUndo).toBe(true);

    act(() => { result.current.loadScene([player('h1', 9, 9)], []); });
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
    expect(result.current.players).toEqual([player('h1', 9, 9)]);
  });

  it('setPlayersRaw (Namensänderung) pusht KEIN Undo', () => {
    const { result } = renderHook(() => useDrawing());

    act(() => { result.current.loadScene([player('h1', 0, 0)], []); });
    act(() => {
      result.current.setPlayersRaw((prev) => prev.map((p) => (p.id === 'h1' ? { ...p, name: 'Max' } : p)));
    });

    expect(result.current.players.find((p) => p.id === 'h1').name).toBe('Max');
    expect(result.current.canUndo).toBe(false);
  });

  it('applyFormation pusht Undo mit Label "formation"', () => {
    const { result } = renderHook(() => useDrawing());

    act(() => { result.current.loadScene([player('h1', 0, 0)], []); });
    act(() => { result.current.applyFormation([player('h1', 3, 3), player('h2', 4, 4)]); });

    expect(result.current.players).toHaveLength(2);
    expect(result.current.undoStack.at(-1).label).toBe('formation');

    act(() => { result.current.undo(); });
    expect(result.current.players).toEqual([player('h1', 0, 0)]);
  });
});

describe('useDrawing – Trainingszone (Layer-System, CLAUDE.md §10.2)', () => {
  it('zeichnet eine Zone per Pointer-Drag genau wie einen Pfeil (derselbe Undo-fähige Dispatch-Pfad)', () => {
    const { result } = renderHook(() => useDrawing());

    act(() => { result.current.setActiveTool('zone'); });
    act(() => { result.current.handlePointerDown(1, 1); });
    act(() => { result.current.handlePointerMove(5, 4); });
    act(() => { result.current.handlePointerUp(); });

    expect(result.current.elements).toHaveLength(1);
    expect(result.current.elements[0]).toMatchObject({ type: 'zone', x1: 1, y1: 1, x2: 5, y2: 4 });
    expect(result.current.canUndo).toBe(true);

    act(() => { result.current.undo(); });
    expect(result.current.elements).toHaveLength(0);
  });

  it('addZoneElement (Koordinaten-Formular) legt eine Zone über addArrowElement("zone", …) an', () => {
    const { result } = renderHook(() => useDrawing());
    act(() => { result.current.addArrowElement('zone', 2, 2, 8, 6); });

    expect(result.current.elements).toHaveLength(1);
    expect(result.current.elements[0]).toMatchObject({ type: 'zone', x1: 2, y1: 2, x2: 8, y2: 6 });
    expect(result.current.elements[0].fillOpacity).toBeGreaterThan(0);
  });

  it("'comment'-Werkzeug erzeugt KEIN Frame-Element (öffnet stattdessen einen Dialog außerhalb dieses Hooks)", () => {
    const { result } = renderHook(() => useDrawing());

    act(() => { result.current.setActiveTool('comment'); });
    act(() => { result.current.handlePointerDown(3, 3); });

    expect(result.current.elements).toHaveLength(0);
    expect(result.current.isDrawing).toBe(false);
  });
});

describe('useDrawing – Echtzeit-Co-Editing (onLocalChange + applyRemote)', () => {
  it('applyRemote(movePlayer) wendet die Position an, OHNE undoStack/redoStack zu verändern', () => {
    const { result } = renderHook(() => useDrawing());

    act(() => { result.current.loadScene([player('h1', 0, 0)], []); });
    act(() => { result.current.movePlayer('h1', 1, 1); });
    const stackBefore = result.current.undoStack;
    expect(result.current.canUndo).toBe(true);

    act(() => { result.current.applyRemote({ kind: 'movePlayer', id: 'h1', x: 9, y: 9 }); });

    expect(result.current.players.find((p) => p.id === 'h1')).toMatchObject({ x: 9, y: 9 });
    expect(result.current.undoStack).toBe(stackBefore);
    expect(result.current.redoStack).toEqual([]);

    // Strg+Z darf die fremde Bewegung nicht rückgängig machen, sondern die
    // eigene vorherige movePlayer-Aktion
    act(() => { result.current.undo(); });
    expect(result.current.players.find((p) => p.id === 'h1')).toMatchObject({ x: 0, y: 0 });
  });

  it('applyRemote(addElement/updateElement/deleteElement/clearAll/applyFormation) wendet den State an, ohne die Undo-Historie zu berühren', () => {
    const { result } = renderHook(() => useDrawing());
    act(() => { result.current.loadScene([], []); });
    const stackBefore = result.current.undoStack;

    act(() => { result.current.applyRemote({ kind: 'addElement', element: { id: 'e1', type: 'pass', x1: 0, y1: 0, x2: 1, y2: 1 } }); });
    expect(result.current.elements).toHaveLength(1);
    expect(result.current.undoStack).toBe(stackBefore);

    act(() => { result.current.applyRemote({ kind: 'updateElement', id: 'e1', patch: { color: '#fff' } }); });
    expect(result.current.elements[0]).toMatchObject({ color: '#fff' });
    expect(result.current.undoStack).toBe(stackBefore);

    act(() => { result.current.applyRemote({ kind: 'applyFormation', players: [player('h1', 3, 3)] }); });
    expect(result.current.players).toEqual([player('h1', 3, 3)]);
    expect(result.current.undoStack).toBe(stackBefore);

    act(() => { result.current.applyRemote({ kind: 'deleteElement', id: 'e1' }); });
    expect(result.current.elements).toHaveLength(0);
    expect(result.current.undoStack).toBe(stackBefore);

    act(() => { result.current.applyRemote({ kind: 'addElement', element: { id: 'e2', type: 'shot' } }); });
    act(() => { result.current.applyRemote({ kind: 'clearAll' }); });
    expect(result.current.elements).toHaveLength(0);
    expect(result.current.undoStack).toBe(stackBefore);
    expect(result.current.canUndo).toBe(false);
  });

  it('onLocalChange wird bei movePlayer/deleteElement/clearAll/applyFormation/updateElement mit dem erwarteten Op aufgerufen', () => {
    const onLocalChange = vi.fn();
    const { result } = renderHook(() => useDrawing(onLocalChange));

    act(() => { result.current.loadScene([player('h1', 0, 0)], []); });
    onLocalChange.mockClear(); // loadScene selbst soll NICHT broadcastet werden

    act(() => { result.current.movePlayer('h1', 2, 2); });
    expect(onLocalChange).toHaveBeenLastCalledWith({ kind: 'movePlayer', id: 'h1', x: 2, y: 2 });

    act(() => { result.current.applyFormation([player('h1', 5, 5)]); });
    expect(onLocalChange).toHaveBeenLastCalledWith({ kind: 'applyFormation', players: [player('h1', 5, 5)] });

    act(() => { result.current.addElement({ type: 'pass', x1: 0, y1: 0, x2: 1, y2: 1 }); });
    const addedId = result.current.elements[0].id;
    expect(onLocalChange).toHaveBeenLastCalledWith({ kind: 'addElement', element: expect.objectContaining({ id: addedId, type: 'pass' }) });

    act(() => { result.current.updateElement(addedId, { color: '#000' }); });
    expect(onLocalChange).toHaveBeenLastCalledWith({ kind: 'updateElement', id: addedId, patch: { color: '#000' } });

    act(() => { result.current.deleteElement(addedId); });
    expect(onLocalChange).toHaveBeenLastCalledWith({ kind: 'deleteElement', id: addedId });

    act(() => { result.current.clearAll(); });
    expect(onLocalChange).toHaveBeenLastCalledWith({ kind: 'clearAll' });
  });

  it('onLocalChange wird NICHT bei loadScene oder setPlayersRaw aufgerufen', () => {
    const onLocalChange = vi.fn();
    const { result } = renderHook(() => useDrawing(onLocalChange));

    act(() => { result.current.loadScene([player('h1', 0, 0)], []); });
    act(() => {
      result.current.setPlayersRaw((prev) => prev.map((p) => (p.id === 'h1' ? { ...p, name: 'Max' } : p)));
    });

    expect(onLocalChange).not.toHaveBeenCalled();
  });

  it('handlePointerUp broadcastet erst das FERTIGE Element, nicht die Zwischenpunkte während der Geste', () => {
    const onLocalChange = vi.fn();
    const { result } = renderHook(() => useDrawing(onLocalChange));

    act(() => { result.current.setActiveTool('pass'); });
    act(() => { result.current.handlePointerDown(0, 0); });
    // Startpunkt-Erzeugung broadcastet noch nicht
    expect(onLocalChange).not.toHaveBeenCalled();

    act(() => { result.current.handlePointerMove(1, 1); });
    act(() => { result.current.handlePointerMove(2, 2); });
    // Zwischenpunkte (SET_ELEMENTS_RAW) broadcasten nicht
    expect(onLocalChange).not.toHaveBeenCalled();

    act(() => { result.current.handlePointerUp(); });
    expect(onLocalChange).toHaveBeenCalledTimes(1);
    expect(onLocalChange).toHaveBeenCalledWith({
      kind: 'addElement',
      element: expect.objectContaining({ type: 'pass', x1: 0, y1: 0, x2: 2, y2: 2 }),
    });
  });
});
