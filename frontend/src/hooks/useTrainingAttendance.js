/**
 * useTrainingAttendance – tatsächliche Anwesenheit bei einem Training
 * (Statistik-Architektur Phase 5). Struktur exakt analog useMatchSquad.js
 * (game_squad-Pendant für training_sessions statt games).
 */
import { useState, useCallback } from 'react';
import { apiFetch } from '../utils/apiFetch.js';

export function useTrainingAttendance(sessionId) {
  const [attendance, setAttendance] = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);

  const basePath = `/api/trainings/${sessionId}/attendance`;

  const fetchAttendance = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const data = await apiFetch(basePath);
      setAttendance(data);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [basePath, sessionId]);

  const setStatus = useCallback(async (rosterPlayerId, status, note = '') => {
    try {
      const updated = await apiFetch(`${basePath}/${rosterPlayerId}`, { method: 'PUT', body: JSON.stringify({ status, note }) });
      setAttendance((prev) => prev.map((p) => p.rosterPlayerId === rosterPlayerId ? updated : p));
      return updated;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [basePath]);

  const clearStatus = useCallback(async (rosterPlayerId) => {
    try {
      await apiFetch(`${basePath}/${rosterPlayerId}`, { method: 'DELETE' });
      setAttendance((prev) => prev.map((p) => p.rosterPlayerId === rosterPlayerId ? { ...p, status: null, note: '' } : p));
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [basePath]);

  return {
    attendance, loading, error,
    fetchAttendance, setStatus, clearStatus,
  };
}
