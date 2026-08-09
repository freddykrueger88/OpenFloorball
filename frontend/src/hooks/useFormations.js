/**
 * useFormations – State-Management für Formations-Vorlagen (Issue #46)
 * Nutzer-gebunden (nicht board-gebunden) – über alle eigenen Boards
 * hinweg wiederverwendbar.
 */
import { useState, useCallback } from 'react';
import { apiFetch } from '../utils/apiFetch.js';

const BASE = '/api/formations';

export function useFormations() {
  const [formations, setFormations] = useState([]);
  const [loading,     setLoading   ] = useState(false);
  const [error,       setError     ] = useState(null);

  const fetchFormations = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch(BASE);
      setFormations(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const saveFormation = useCallback(async ({ name, fieldType, players, teamId = null }) => {
    try {
      const newFormation = await apiFetch(BASE, {
        method: 'POST',
        body: JSON.stringify({ name, fieldType, players, teamId }),
      });
      setFormations((prev) => [newFormation, ...prev]);
      return newFormation;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  // Offline-Konflikterkennung (siehe offlineSync.js), analog useRoster.js:
  // der Aufrufer kennt die aktuell geladene formation.updatedAt/formation.name.
  const updateFormation = useCallback(async (id, patch, { baselineUpdatedAt = null, label = null } = {}) => {
    try {
      const updated = await apiFetch(`${BASE}/${id}`, { method: 'PUT', body: JSON.stringify(patch) }, {
        baselineUpdatedAt, conflictCheckUrl: `${BASE}/${id}`, label,
      });
      setFormations((prev) => prev.map((f) => f._id === id ? updated : f));
      return updated;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const deleteFormation = useCallback(async (id) => {
    try {
      await apiFetch(`${BASE}/${id}`, { method: 'DELETE' });
      setFormations((prev) => prev.filter((f) => f._id !== id));
    } catch (err) {
      setError(err.message);
    }
  }, []);

  return {
    formations, loading, error,
    fetchFormations, saveFormation, updateFormation, deleteFormation,
    canAddFormation: formations.length < 20,
  };
}
