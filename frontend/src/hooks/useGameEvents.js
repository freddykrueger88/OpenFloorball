/**
 * useGameEvents – Live-Match-Ereignisse (Roadmap-Audit, Start Phase C).
 * Struktur analog useComments.js, deckt aber nur die 10 festen
 * IFF-Presets ab (Anstoß/Drittelende/Auszeit/Tor/Strafen/Spielende) –
 * Freitext-Notizen bleiben über useComments('games', id) laufen.
 */
import { useState, useCallback } from 'react';
import { apiFetch } from '../utils/apiFetch.js';

export function useGameEvents(gameId) {
  const [events,  setEvents ] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError  ] = useState(null);

  const basePath = `/api/games/${gameId}/events`;

  const fetchEvents = useCallback(async () => {
    if (!gameId) return;
    setLoading(true);
    try {
      const data = await apiFetch(basePath);
      setEvents(data);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [basePath, gameId]);

  // Verallgemeinert (Statistik-Architektur Phase 3, Schuss-Tracking):
  // nimmt ein beliebiges Body-Objekt statt fixer 3 Felder entgegen, damit
  // auch die neuen optionalen Schuss-Felder (x/y/outcome/shotType/
  // secondaryRosterPlayerId/…) durchgereicht werden können – bestehende
  // Aufrufer (z.B. handleAddPreset in GamePage.jsx) bleiben unverändert
  // kompatibel, da sie bereits ein Objekt übergeben.
  const addEvent = useCallback(async (body) => {
    try {
      const event = await apiFetch(basePath, { method: 'POST', body: JSON.stringify(body) });
      setEvents((prev) => [...prev, event]);
      return event;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [basePath]);

  const deleteEvent = useCallback(async (eventId) => {
    try {
      await apiFetch(`${basePath}/${eventId}`, { method: 'DELETE' });
      setEvents((prev) => prev.filter((e) => e._id !== eventId));
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [basePath]);

  return {
    events, loading, error,
    fetchEvents, addEvent, deleteEvent,
  };
}
