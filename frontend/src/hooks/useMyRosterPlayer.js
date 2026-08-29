/**
 * useMyRosterPlayer – Spieler-Dashboard-Ausbau: der mit dem eigenen
 * Account verknüpfte Kader-Eintrag (`GET /api/roster/me`), falls
 * vorhanden. `null` ist ein normaler Zustand (nicht verknüpft), kein Fehler.
 */
import { useState, useCallback } from 'react';
import { apiFetch } from '../utils/apiFetch.js';

export function useMyRosterPlayer() {
  const [myRosterPlayer, setMyRosterPlayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMyRosterPlayer = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/api/roster/me');
      setMyRosterPlayer(data);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { myRosterPlayer, loading, error, fetchMyRosterPlayer };
}
