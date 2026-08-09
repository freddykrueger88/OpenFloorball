/**
 * useMatchSquad – Match-Kader für ein konkretes Spiel (Roadmap-Audit),
 * Struktur analog useRsvps.js. Anders als RSVP (Status pro User) ist
 * das hier ein Status pro Kader-Spieler (roster_players), vom Trainer
 * gesetzt statt selbst berichtet.
 */
import { useState, useCallback } from 'react';
import { apiFetch } from '../utils/apiFetch.js';

export function useMatchSquad(gameId) {
  const [squad,   setSquad  ] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError  ] = useState(null);

  const basePath = `/api/games/${gameId}/squad`;

  const fetchSquad = useCallback(async () => {
    if (!gameId) return;
    setLoading(true);
    try {
      const data = await apiFetch(basePath);
      setSquad(data);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [basePath, gameId]);

  const setStatus = useCallback(async (rosterPlayerId, status, note = '') => {
    try {
      const updated = await apiFetch(`${basePath}/${rosterPlayerId}`, { method: 'PUT', body: JSON.stringify({ status, note }) });
      setSquad((prev) => prev.map((p) => p.rosterPlayerId === rosterPlayerId ? updated : p));
      return updated;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [basePath]);

  const clearStatus = useCallback(async (rosterPlayerId) => {
    try {
      await apiFetch(`${basePath}/${rosterPlayerId}`, { method: 'DELETE' });
      setSquad((prev) => prev.map((p) => p.rosterPlayerId === rosterPlayerId ? { ...p, status: null, note: '' } : p));
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [basePath]);

  return {
    squad, loading, error,
    fetchSquad, setStatus, clearStatus,
  };
}
