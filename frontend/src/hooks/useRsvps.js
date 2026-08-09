/**
 * useRsvps – Zusage/Absage/Unsicher für Spiele und Trainingseinheiten
 * (Roadmap-Audit: RSVP/Anwesenheit). Struktur analog useComments.js,
 * parametrisiert über resourceKind ('games' | 'trainings') + resourceId,
 * da beide Ressourcentypen dieselbe API-Form unter unterschiedlichen
 * Mountpunkten teilen (siehe backend/src/routes/rsvps.js).
 */
import { useState, useCallback } from 'react';
import { apiFetch } from '../utils/apiFetch.js';

export function useRsvps(resourceKind, resourceId) {
  const [roster,  setRoster ] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError  ] = useState(null);

  const basePath = `/api/${resourceKind}/${resourceId}/rsvps`;

  const fetchRsvps = useCallback(async () => {
    if (!resourceId) return;
    setLoading(true);
    try {
      const data = await apiFetch(basePath);
      setRoster(data);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [basePath, resourceId]);

  const setMyRsvp = useCallback(async (status, reason = '') => {
    try {
      const updated = await apiFetch(`${basePath}/me`, { method: 'PUT', body: JSON.stringify({ status, reason }) });
      setRoster((prev) => prev.map((r) => r.userId === updated.userId ? updated : r));
      return updated;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [basePath]);

  return {
    roster, loading, error,
    fetchRsvps, setMyRsvp,
  };
}
