/**
 * useOpponents – API-Hook für die Gegner-Bilanz (strukturierte
 * Gegner-Entität, ADR-0007). Rein lesend: Gegner entstehen automatisch
 * über resolveOpponentId beim Anlegen/Ändern eines Spiels (useGames.js),
 * kein eigener Create/Update/Delete hier.
 */
import { useState, useCallback } from 'react';
import { apiFetch } from '../utils/apiFetch.js';

const BASE = '/api/opponents';

export function useOpponents() {
  const [opponents, setOpponents] = useState([]);
  const [loading,   setLoading  ] = useState(false);
  const [error,     setError    ] = useState(null);

  const fetchOpponents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch(BASE);
      setOpponents(data);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { opponents, loading, error, fetchOpponents };
}
