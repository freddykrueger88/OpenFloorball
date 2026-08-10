/**
 * useGameClock – Spieluhr-Aktionen (Roadmap-Audit, letzter größerer
 * Baustein Phase C). Reine REST-Actions – die Autorität für den
 * Uhr-Zustand bleibt der Server, dieser Hook bildet nur die vier
 * Aktionen ab. Echtzeit-Sync über mehrere Geräte/Tabs läuft separat
 * über useGameClockSync.js (WebSocket).
 */
import { useState, useCallback } from 'react';
import { apiFetch } from '../utils/apiFetch.js';

export function useGameClock() {
  const [error, setError] = useState(null);

  const runAction = useCallback((gameId, action) => async () => {
    try {
      return await apiFetch(`/api/games/${gameId}/clock/${action}`, { method: 'POST' });
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const start      = useCallback((gameId) => runAction(gameId, 'start')(), [runAction]);
  const pause      = useCallback((gameId) => runAction(gameId, 'pause')(), [runAction]);
  const nextPeriod = useCallback((gameId) => runAction(gameId, 'next-period')(), [runAction]);
  const reset      = useCallback((gameId) => runAction(gameId, 'reset')(), [runAction]);

  return { error, start, pause, nextPeriod, reset };
}
