/**
 * useGames – API-Hook für Spiele (Live-Spielnotizen), analog
 * useTrainingSessions.js. Die Notizen selbst laufen NICHT über diesen
 * Hook, sondern über useComments('games', gameId) – siehe
 * gamesController.js für die Begründung (comments statt eigener Tabelle).
 */
import { useState, useCallback } from 'react';
import { apiFetch } from '../utils/apiFetch.js';

const BASE = '/api/games';
const MAX_GAMES = 30;

export function useGames() {
  const [games,   setGames  ] = useState([]);
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

  const fetchGames = useCallback(() =>
    request(async () => setGames(await apiFetch(BASE))), [request]);

  const fetchGame = useCallback((id) =>
    request(() => apiFetch(`${BASE}/${id}`)), [request]);

  const createGame = useCallback((opponent, playedAt = null, teamId = null) =>
    request(async () => {
      const newGame = await apiFetch(BASE, { method: 'POST', body: JSON.stringify({ opponent, playedAt, teamId }) });
      setGames((prev) => [newGame, ...prev]);
      return newGame;
    }), [request]);

  // Offline-Konflikterkennung (siehe offlineSync.js), analog useTrainingSessions.js
  const updateGame = useCallback((id, patch, { baselineUpdatedAt = null, label = null } = {}) =>
    request(async () => {
      const updated = await apiFetch(`${BASE}/${id}`, { method: 'PUT', body: JSON.stringify(patch) }, {
        baselineUpdatedAt, conflictCheckUrl: `${BASE}/${id}`, label,
      });
      setGames((prev) => prev.map((g) => g._id === id ? updated : g));
      return updated;
    }), [request]);

  const deleteGame = useCallback((id, { baselineUpdatedAt = null, label = null } = {}) =>
    request(async () => {
      await apiFetch(`${BASE}/${id}`, { method: 'DELETE' }, {
        baselineUpdatedAt, conflictCheckUrl: `${BASE}/${id}`, label,
      });
      setGames((prev) => prev.filter((g) => g._id !== id));
    }), [request]);

  return {
    games, loading, error,
    fetchGames, fetchGame, createGame, updateGame, deleteGame,
    canAddGame: games.length < MAX_GAMES,
  };
}
