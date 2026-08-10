/**
 * useRosterStats – Spieler-Statistiken (Roadmap-Audit, Fortsetzung
 * Phase C). Rein lesend, keine eigene Ressource – nutzt die bestehende
 * roster_players-Liste, nur mit angehängten Kennzahlen.
 */
import { useState, useCallback } from 'react';
import { apiFetch } from '../utils/apiFetch.js';

export function useRosterStats() {
  const [stats,   setStats  ] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError  ] = useState(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/api/roster/stats');
      setStats(data);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { stats, loading, error, fetchStats };
}
