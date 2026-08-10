/**
 * useTrainingSessionItems – Item-Verwaltung für eine geöffnete
 * Trainingseinheit (Issue #45): Session-Detail laden, Übungen
 * hinzufügen/ändern/entfernen/umsortieren.
 */
import { useState, useCallback } from 'react';
import { apiFetch } from '../utils/apiFetch.js';

const BASE = '/api/trainings';
const MAX_ITEMS = 30;

export function useTrainingSessionItems() {
  const [session, setSession] = useState(null);
  const [items,   setItems  ] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError  ] = useState(null);

  const request = useCallback(async (fn) => {
    setLoading(true);
    setError(null);
    try {
      return await fn();
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSession = useCallback((sessionId) =>
    request(async () => {
      const data = await apiFetch(`${BASE}/${sessionId}`);
      const { items: fetchedItems, ...meta } = data;
      setSession(meta);
      setItems(fetchedItems);
      return data;
    }), [request]);

  const updateSession = useCallback((sessionId, patch) =>
    request(async () => {
      const updated = await apiFetch(`${BASE}/${sessionId}`, { method: 'PUT', body: JSON.stringify(patch) });
      setSession((prev) => ({ ...prev, ...updated }));
      return updated;
    }), [request]);

  // Roadmap-Audit "Serientermine": erzeugt unabhängige Folge-Termine
  // (kein Serien-Tracking) – betrifft weder `session` noch `items`
  // dieses Hooks, die neuen Termine sind eigenständige Entitäten und
  // erscheinen in der Trainings-/Kalenderübersicht.
  const repeatSession = useCallback((sessionId, { repeat, until }) =>
    request(() => apiFetch(`${BASE}/${sessionId}/repeat`, { method: 'POST', body: JSON.stringify({ repeat, until }) })),
    [request]);

  const addItem = useCallback((sessionId, { boardId, durationMinutes, note }) =>
    request(async () => {
      const newItem = await apiFetch(`${BASE}/${sessionId}/items`, {
        method: 'POST',
        body: JSON.stringify({ boardId, durationMinutes, note }),
      });
      setItems((prev) => [...prev, newItem]);
      return newItem;
    }), [request]);

  const updateItem = useCallback((sessionId, itemId, patch) =>
    request(async () => {
      const updated = await apiFetch(`${BASE}/${sessionId}/items/${itemId}`, {
        method: 'PUT',
        body: JSON.stringify(patch),
      });
      setItems((prev) => prev.map((i) => i._id === itemId ? updated : i));
      return updated;
    }), [request]);

  const removeItem = useCallback((sessionId, itemId) =>
    request(async () => {
      await apiFetch(`${BASE}/${sessionId}/items/${itemId}`, { method: 'DELETE' });
      setItems((prev) => prev
        .filter((i) => i._id !== itemId)
        .map((i, idx) => ({ ...i, order: idx })));
    }), [request]);

  const reorderItems = useCallback((sessionId, order) =>
    request(async () => {
      const reordered = await apiFetch(`${BASE}/${sessionId}/items/reorder`, {
        method: 'PUT',
        body: JSON.stringify({ order }),
      });
      setItems(reordered);
      return reordered;
    }), [request]);

  const moveItem = useCallback((sessionId, index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= items.length) return Promise.resolve();
    const next = [...items];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    return reorderItems(sessionId, next.map((i) => i._id));
  }, [items, reorderItems]);

  return {
    session, items, loading, error,
    fetchSession, updateSession, repeatSession, addItem, updateItem, removeItem, reorderItems, moveItem,
    canAddItem: items.length < MAX_ITEMS,
  };
}
