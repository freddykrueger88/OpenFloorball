/**
 * usePlaybooks – State-Management für Playbooks/Board-Sammlungen (Issue #52)
 * Nutzer-gebunden (nicht board-gebunden) – über alle eigenen Boards
 * hinweg wiederverwendbar.
 */
import { useState, useCallback } from 'react';
import { apiFetch } from '../utils/apiFetch.js';

const BASE = '/api/playbooks';

export function usePlaybooks() {
  const [playbooks, setPlaybooks] = useState([]);
  const [loading,   setLoading  ] = useState(false);
  const [error,     setError    ] = useState(null);

  const fetchPlaybooks = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch(BASE);
      setPlaybooks(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const createPlaybook = useCallback(async (name, teamId = null, organizationId = null) => {
    try {
      const newPlaybook = await apiFetch(BASE, {
        method: 'POST',
        body: JSON.stringify({ name, teamId, organizationId }),
      });
      setPlaybooks((prev) => [...prev, newPlaybook]);
      return newPlaybook;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  // Offline-Konflikterkennung (siehe offlineSync.js), analog useRoster.js:
  // der Aufrufer kennt das aktuell geladene playbook.updatedAt/playbook.name.
  const updatePlaybook = useCallback(async (id, patch, { baselineUpdatedAt = null, label = null } = {}) => {
    try {
      const updated = await apiFetch(`${BASE}/${id}`, { method: 'PUT', body: JSON.stringify(patch) }, {
        baselineUpdatedAt, conflictCheckUrl: `${BASE}/${id}`, label,
      });
      setPlaybooks((prev) => prev.map((p) => p._id === id ? updated : p));
      return updated;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const deletePlaybook = useCallback(async (id) => {
    try {
      await apiFetch(`${BASE}/${id}`, { method: 'DELETE' });
      setPlaybooks((prev) => prev.filter((p) => p._id !== id));
    } catch (err) {
      setError(err.message);
    }
  }, []);

  return {
    playbooks, loading, error,
    fetchPlaybooks, createPlaybook, updatePlaybook, deletePlaybook,
    canAddPlaybook: playbooks.length < 15,
  };
}
