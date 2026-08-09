/**
 * useLines – API-Hook für Lines: taktische Zusammenstellungen echter
 * Kader-Spieler (fachlicher Umbau, siehe linesController.js). Nicht mehr
 * board-gebunden, analog useGames.js/useRoster.js.
 */
import { useState, useCallback } from 'react';
import { apiFetch } from '../utils/apiFetch.js';

const BASE = '/api/lines';
const MAX_LINES = 20;

export function useLines() {
  const [lines,   setLines  ] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError  ] = useState(null);

  const request = useCallback(async (fn) => {
    setLoading(true);
    setError(null);
    try {
      return await fn();
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLines = useCallback(() =>
    request(async () => setLines(await apiFetch(BASE))), [request]);

  const createLine = useCallback((name, color, type, teamId = null) =>
    request(async () => {
      const newLine = await apiFetch(BASE, { method: 'POST', body: JSON.stringify({ name, color, type, teamId }) });
      setLines((prev) => [...prev, newLine]);
      return newLine;
    }), [request]);

  const updateLine = useCallback((id, patch, { baselineUpdatedAt = null, label = null } = {}) =>
    request(async () => {
      const updated = await apiFetch(`${BASE}/${id}`, { method: 'PUT', body: JSON.stringify(patch) }, {
        baselineUpdatedAt, conflictCheckUrl: `${BASE}/${id}`, label,
      });
      setLines((prev) => prev.map((l) => l._id === id ? updated : l));
      return updated;
    }), [request]);

  const deleteLine = useCallback((id, { baselineUpdatedAt = null, label = null } = {}) =>
    request(async () => {
      await apiFetch(`${BASE}/${id}`, { method: 'DELETE' }, {
        baselineUpdatedAt, conflictCheckUrl: `${BASE}/${id}`, label,
      });
      setLines((prev) => prev.filter((l) => l._id !== id));
    }), [request]);

  const addPlayer = useCallback((lineId, rosterPlayerId) =>
    request(async () => {
      const players = await apiFetch(`${BASE}/${lineId}/players`, { method: 'POST', body: JSON.stringify({ rosterPlayerId }) });
      setLines((prev) => prev.map((l) => l._id === lineId ? { ...l, players } : l));
      return players;
    }), [request]);

  const removePlayer = useCallback((lineId, rosterPlayerId) =>
    request(async () => {
      const players = await apiFetch(`${BASE}/${lineId}/players/${rosterPlayerId}`, { method: 'DELETE' });
      setLines((prev) => prev.map((l) => l._id === lineId ? { ...l, players } : l));
      return players;
    }), [request]);

  // Aktivieren/Deaktivieren löst serverseitig die Exklusivität aus (alle
  // anderen Lines derselben Sichtbarkeits-Gruppe werden deaktiviert) – hier
  // deshalb nach dem Request die komplette Liste neu laden statt lokal zu
  // patchen, sonst wüssten wir nicht, welche anderen Lines betroffen waren.
  const setActive = useCallback((lineId, active) =>
    request(async () => {
      await apiFetch(`${BASE}/${lineId}/active`, { method: 'PUT', body: JSON.stringify({ active }) });
      setLines(await apiFetch(BASE));
    }), [request]);

  return {
    lines, loading, error,
    fetchLines, createLine, updateLine, deleteLine,
    addPlayer, removePlayer, setActive,
    canAddLine: lines.length < MAX_LINES,
  };
}
