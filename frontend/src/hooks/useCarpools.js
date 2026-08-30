/**
 * useCarpools – Fahrgemeinschaften für Spiele und Trainingseinheiten
 * (ISSUE 028). Struktur analog useRsvps.js, parametrisiert über
 * resourceKind ('games' | 'trainings') + resourceId.
 */
import { useState, useCallback } from 'react';
import { apiFetch } from '../utils/apiFetch.js';

export function useCarpools(resourceKind, resourceId) {
  const [offers,  setOffers ] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError  ] = useState(null);

  const basePath = `/api/${resourceKind}/${resourceId}/carpools`;

  const fetchOffers = useCallback(async () => {
    if (!resourceId) return;
    setLoading(true);
    try {
      const data = await apiFetch(basePath);
      setOffers(data);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [basePath, resourceId]);

  const createOffer = useCallback(async (meetingPoint, totalSeats, note = '') => {
    try {
      const offer = await apiFetch(basePath, { method: 'POST', body: JSON.stringify({ meetingPoint, totalSeats, note }) });
      setOffers((prev) => [...prev, offer]);
      return offer;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [basePath]);

  const deleteOffer = useCallback(async (offerId) => {
    try {
      await apiFetch(`${basePath}/${offerId}`, { method: 'DELETE' });
      setOffers((prev) => prev.filter((o) => o._id !== offerId));
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [basePath]);

  const claimSeat = useCallback(async (offerId) => {
    try {
      const claim = await apiFetch(`${basePath}/${offerId}/claims`, { method: 'POST' });
      setOffers((prev) => prev.map((o) => (o._id === offerId ? { ...o, claims: [...o.claims, claim] } : o)));
      return claim;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [basePath]);

  const deleteClaim = useCallback(async (offerId, claimId) => {
    try {
      await apiFetch(`${basePath}/${offerId}/claims/${claimId}`, { method: 'DELETE' });
      setOffers((prev) => prev.map((o) => (o._id === offerId ? { ...o, claims: o.claims.filter((c) => c._id !== claimId) } : o)));
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [basePath]);

  return {
    offers, loading, error,
    fetchOffers, createOffer, deleteOffer, claimSeat, deleteClaim,
  };
}
