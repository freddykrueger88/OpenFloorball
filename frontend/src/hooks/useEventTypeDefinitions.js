/**
 * useEventTypeDefinitions – Custom Events/Tags (Statistik-Architektur
 * Phase 7). Liefert eingebaute + eigene (Team-/persönliche) Ereignistypen,
 * global (nicht spielgebunden) – Filterung auf "für DIESES Spiel
 * nutzbar" passiert im aufrufenden Code (siehe GamePage.jsx), da hier
 * kein Spielkontext bekannt ist.
 */
import { useState, useCallback } from 'react';
import { apiFetch } from '../utils/apiFetch.js';

const BASE = '/api/event-types';

export function useEventTypeDefinitions() {
  const [eventTypes, setEventTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchEventTypes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch(BASE);
      setEventTypes(data);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const createEventType = useCallback(async (body) => {
    try {
      const createdType = await apiFetch(BASE, { method: 'POST', body: JSON.stringify(body) });
      setEventTypes((prev) => [...prev, createdType]);
      return createdType;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const updateEventType = useCallback(async (key, patch) => {
    try {
      const updated = await apiFetch(`${BASE}/${key}`, { method: 'PUT', body: JSON.stringify(patch) });
      setEventTypes((prev) => prev.map((t) => (t.key === key ? updated : t)));
      return updated;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const deleteEventType = useCallback(async (key) => {
    try {
      await apiFetch(`${BASE}/${key}`, { method: 'DELETE' });
      setEventTypes((prev) => prev.filter((t) => t.key !== key));
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  return { eventTypes, loading, error, fetchEventTypes, createEventType, updateEventType, deleteEventType };
}
