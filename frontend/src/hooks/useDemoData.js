/**
 * useDemoData – Status/Erzeugen/Löschen der Demo-Testumgebung
 * (Onboarding-Ausbau), Muster wie useSettings.js
 */
import { useState, useCallback, useEffect } from 'react';
import { apiFetch } from '../utils/apiFetch.js';

export function useDemoData() {
  const [status, setStatus] = useState(null); // { hasDemoData, seededAt }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStatus(await apiFetch('/api/demo-data'));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const createDemoData = useCallback(async () => {
    setError(null);
    try {
      const data = await apiFetch('/api/demo-data', { method: 'POST' });
      setStatus(data);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const deleteDemoData = useCallback(async () => {
    setError(null);
    try {
      const data = await apiFetch('/api/demo-data', { method: 'DELETE' });
      setStatus(data);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  return { status, loading, error, createDemoData, deleteDemoData, reload: load };
}
