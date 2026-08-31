import { describe, it, expect } from 'vitest';
import { filterVisiblePlayers, filterVisibleElements } from './layerVisibilityFilter.js';

describe('filterVisiblePlayers', () => {
  it('keeps the ball regardless of visible/layerVisibility', () => {
    const players = [{ id: 'ball', team: 'ball', visible: false }];
    expect(filterVisiblePlayers(players, { away: false })).toEqual(players);
  });

  it('hides a player with visible:false', () => {
    const players = [{ id: 'h1', team: 'home', visible: false }];
    expect(filterVisiblePlayers(players, {})).toEqual([]);
  });

  it('keeps a player without a visible field (existing boards)', () => {
    const players = [{ id: 'h1', team: 'home' }];
    expect(filterVisiblePlayers(players, {})).toEqual(players);
  });

  it('hides a whole team via layerVisibility', () => {
    const players = [
      { id: 'h1', team: 'home' },
      { id: 'a1', team: 'away' },
    ];
    expect(filterVisiblePlayers(players, { away: false })).toEqual([players[0]]);
  });

  it('combines per-player visible and team layerVisibility (AND)', () => {
    const players = [
      { id: 'h1', team: 'home', visible: false },
      { id: 'h2', team: 'home' },
    ];
    expect(filterVisiblePlayers(players, { home: true })).toEqual([players[1]]);
  });
});

describe('filterVisibleElements', () => {
  it('keeps elements without a matching layerVisibility key', () => {
    const elements = [{ id: 'e1', type: 'pass' }];
    expect(filterVisibleElements(elements, {})).toEqual(elements);
  });

  it('hides elements whose type is toggled off', () => {
    const elements = [
      { id: 'e1', type: 'move' },
      { id: 'e2', type: 'zone' },
    ];
    expect(filterVisibleElements(elements, { zone: false })).toEqual([elements[0]]);
  });
});
