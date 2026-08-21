/**
 * usePlayerDevelopmentNotes – freie Beobachtungsnotizen zu einem
 * Kader-Spieler (Statistik-Architektur Phase 5). Nur coach/owner
 * bekommen Daten vom Backend (404 sonst, siehe
 * playerDevelopmentNotesController.js) – dieser Hook stellt das nicht
 * gesondert fest, der Aufrufer behandelt einen 404-Fetch-Fehler wie
 * "keine Berechtigung/Sektion ausblenden".
 */
import { useState, useCallback } from 'react';
import { apiFetch } from '../utils/apiFetch.js';

export function usePlayerDevelopmentNotes(playerId) {
  const [notes,   setNotes]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const basePath = `/api/roster/${playerId}/notes`;

  const fetchNotes = useCallback(async () => {
    if (!playerId) return;
    setLoading(true);
    try {
      const data = await apiFetch(basePath);
      setNotes(data);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [basePath, playerId]);

  const addNote = useCallback(async (note, trainingSessionId = null) => {
    const created = await apiFetch(basePath, { method: 'POST', body: JSON.stringify({ note, trainingSessionId }) });
    setNotes((prev) => [created, ...prev]);
    return created;
  }, [basePath]);

  const editNote = useCallback(async (noteId, note) => {
    const updated = await apiFetch(`${basePath}/${noteId}`, { method: 'PUT', body: JSON.stringify({ note }) });
    setNotes((prev) => prev.map((n) => n._id === noteId ? updated : n));
    return updated;
  }, [basePath]);

  const removeNote = useCallback(async (noteId) => {
    await apiFetch(`${basePath}/${noteId}`, { method: 'DELETE' });
    setNotes((prev) => prev.filter((n) => n._id !== noteId));
  }, [basePath]);

  return { notes, loading, error, fetchNotes, addNote, editNote, removeNote };
}
