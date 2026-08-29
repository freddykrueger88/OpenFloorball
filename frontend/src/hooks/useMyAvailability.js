/**
 * useMyAvailability – Spieler-Dashboard-Ausbau: eigene Zu-/Absage direkt im
 * Dashboard, mit Optimistic Update + Rollback. Nutzt dieselbe bestehende
 * RSVP-API wie RsvpSection.jsx/useRsvps.js (PUT /api/{games|trainings}/:id/
 * rsvps/me) – dort NICHT optimistisch, hier bewusst schon, da eine
 * Dashboard-Karte sofortiges Feedback ohne Warten auf den Server braucht.
 * Der initiale Status kommt aus der bestehenden Roster-weiten GET-Liste
 * (kein neuer "nur meine Zeile"-Endpoint nötig, Teams sind klein genug).
 */
import { useState, useCallback } from 'react';
import { apiFetch } from '../utils/apiFetch.js';
import useAuthStore from '../store/authStore.js';

// resourceKind: 'games' | 'trainings'
export function useMyAvailability(resourceKind, resourceId) {
  const user = useAuthStore((s) => s.user);
  const [status, setStatus] = useState(null); // 'yes' | 'no' | 'maybe' | null
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [justSaved, setJustSaved] = useState(false);

  const basePath = `/api/${resourceKind}/${resourceId}/rsvps`;

  const load = useCallback(async () => {
    if (!resourceId) return;
    try {
      const roster = await apiFetch(basePath);
      setStatus(roster.find((r) => r.userId === user?.id)?.status ?? null);
    } catch {
      // Dashboard bleibt ohne Verfügbarkeits-Status funktionsfähig, kein
      // eigener Fehlerzustand nötig – die Karte zeigt dann einfach "offen".
    }
  }, [basePath, resourceId, user?.id]);

  const respond = useCallback(async (newStatus) => {
    const previous = status;
    setStatus(newStatus);
    setSaving(true);
    setError(null);
    setJustSaved(false);
    try {
      await apiFetch(`${basePath}/me`, { method: 'PUT', body: JSON.stringify({ status: newStatus, reason: '' }) });
      setJustSaved(true);
      // Nicht dauerhaft stehen bleiben – "kurze, nicht störende Bestätigung".
      setTimeout(() => setJustSaved(false), 2500);
    } catch (err) {
      setStatus(previous);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }, [basePath, status]);

  return { status, saving, error, justSaved, load, respond };
}
