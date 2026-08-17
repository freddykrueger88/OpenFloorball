/**
 * useGameLog – Spiel-für-Spiel-Verlauf eines Kader-Spielers (Trends,
 * Statistik-Architektur Phase 4). Liefert Rohzahlen je Spiel, keine
 * fertigen Prozentwerte – Fenster-Aggregation (Last 5/10/Season) läuft
 * im Frontend (aggregateWindow in PlayerTrendsPage.jsx).
 */
import { useState, useCallback } from 'react';
import { apiFetch } from '../utils/apiFetch.js';

export function useGameLog(playerId) {
  const [gameLog, setGameLog] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchGameLog = useCallback(async () => {
    if (!playerId) return;
    setLoading(true);
    try {
      const data = await apiFetch(`/api/roster/${playerId}/game-log`);
      setGameLog(data);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [playerId]);

  return { gameLog, loading, error, fetchGameLog };
}
