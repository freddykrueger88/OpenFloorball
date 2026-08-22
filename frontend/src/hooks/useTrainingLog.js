/**
 * useTrainingLog – Training-für-Training-Anwesenheitsverlauf eines
 * Kader-Spielers (Trends, Statistik-Architektur Phase 5). Struktur
 * analog useGameLog.js.
 */
import { useState, useCallback } from 'react';
import { apiFetch } from '../utils/apiFetch.js';

export function useTrainingLog(playerId) {
  const [trainingLog, setTrainingLog] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchTrainingLog = useCallback(async () => {
    if (!playerId) return;
    setLoading(true);
    try {
      const data = await apiFetch(`/api/roster/${playerId}/training-log`);
      setTrainingLog(data);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [playerId]);

  return { trainingLog, loading, error, fetchTrainingLog };
}
